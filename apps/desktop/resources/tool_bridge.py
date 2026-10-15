# SPDX-License-Identifier: GPL-3.0-only
"""Owned local bridge. Project programs are syntax-checked, never executed on the host."""
import argparse
import ast
import contextlib
import importlib.metadata
import json
import os
from pathlib import Path
import sys
import threading


def tool_info():
    packages = {}
    for name in ("mpremote", "esptool", "pyserial"):
        try:
            packages[name] = importlib.metadata.version(name)
        except importlib.metadata.PackageNotFoundError:
            packages[name] = None
    print(json.dumps({"python": sys.version.split()[0], "packages": packages}))


def ports():
    from serial.tools import list_ports
    print(json.dumps([{"address": p.device, "label": p.description} for p in list_ports.comports()]))


def syntax_check(path):
    source = Path(path).read_text(encoding="utf-8")
    if len(source.encode("utf-8")) > 1_000_000:
        raise ValueError("Source exceeds 1 MB")
    try:
        ast.parse(source, filename=path)
    except SyntaxError as error:
        lines = source.splitlines()
        line = min(max(error.lineno or 1, 1), max(len(lines), 1))
        text = lines[line - 1] if lines else ""
        # Monaco counts UTF-16 units; Python SyntaxError offsets count characters.
        # Older Python f-string offsets can refer to a synthetic expression instead.
        offset = 0 if error.msg.startswith("f-string:") else max((error.offset or 1) - 1, 0)
        column = len(text[:offset].encode("utf-16-le")) // 2 + 1
        print(f"{path}:{line}:{column}: error: {type(error).__name__}: {error.msg}", file=sys.stderr, flush=True)
        raise SystemExit(1)
    print("Syntax OK (host Python parser; device module compatibility is not verified)")


def probe(port):
    from esptool.cmds import attach_flash, connect_esp, reset_chip
    with contextlib.redirect_stdout(sys.stderr):
        with connect_esp(port=port, chip="auto", connect_attempts=3) as esp:
            attach_flash(esp)
            flash_id = esp.flash_id()
            exponent = (flash_id >> 16) & 0xff
            result = {
                "chip": esp.CHIP_NAME.lower().replace("-", ""),
                "description": esp.get_chip_description(),
                "revision": esp.get_chip_revision(),
                "features": esp.get_chip_features(),
                "flashBytes": 1 << exponent if 16 <= exponent <= 32 else 0,
                "secureBoot": bool(esp.get_secure_boot_enabled()),
                "flashEncryption": bool(esp.get_flash_encryption_enabled()),
            }
            reset_chip(esp, "hard-reset")
    print(json.dumps(result))


def repl(port, baud):
    import serial
    stop = threading.Event()
    device = serial.Serial(baudrate=baud, timeout=0.1)
    device.dtr = False
    device.rts = False
    device.port = port
    device.open()
    try:
        # Leave raw REPL if it is idle. This does not interrupt a running program.
        device.write(b"\x02")
        print("EDUBOARD_REPL_READY", flush=True)

        def input_worker():
            try:
                while not stop.is_set():
                    data = os.read(sys.stdin.fileno(), 2048)
                    if not data:
                        break
                    device.write(data)
                    device.flush()
            except (OSError, serial.SerialException) as error:
                print(str(error), file=sys.stderr, flush=True)
            finally:
                stop.set()

        threading.Thread(target=input_worker, daemon=True).start()
        while not stop.is_set():
            data = device.read(min(max(device.in_waiting, 1), 4096))
            if data:
                sys.stdout.buffer.write(data)
                sys.stdout.buffer.flush()
    finally:
        stop.set()
        device.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("info", "ports", "check", "probe", "repl"))
    parser.add_argument("value", nargs="?")
    parser.add_argument("--baud", type=int, default=115200)
    args = parser.parse_args()
    if args.action == "info":
        tool_info()
    elif args.action == "ports":
        ports()
    elif not args.value:
        parser.error("A file or explicit serial port is required")
    elif args.action == "check":
        syntax_check(args.value)
    elif args.action == "probe":
        probe(args.value)
    else:
        repl(args.value, args.baud)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr, flush=True)
        raise SystemExit(1)
