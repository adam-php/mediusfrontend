#!/usr/bin/env python3
with open('app.py', 'r') as f:
    lines = f.readlines()
    print(f"Total lines: {len(lines)}")
    print("Last 10 lines:")
    for i, line in enumerate(lines[-10:], len(lines)-9):
        print("2")

print("\n" + "="*50)
print("Checking for app.run() or similar...")

for i, line in enumerate(lines[-50:], len(lines)-49):
    if 'app.run' in line or 'if __name__' in line:
        print(f"Line {i}: {line.strip()}")
