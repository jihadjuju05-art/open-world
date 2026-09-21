import os
root = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
p = os.path.join(root, 'src/housegen.js'); s = open(p, encoding='utf-8').read()
new = open(os.path.join(root, 'tools/new_buildshell.txt'), encoding='utf-8').read()
a = s.index('// Builds the shell: returns'); b = s.index('function roof(mb, plan, hx, hz) {')
s = s[:a] + new + s[b:]
s = s.replace("function roof(mb, plan, hx, hz) {\n  const { style } = plan, y0 = WALL_H + .16, o =", "function roof(mb, plan, hx, hz, y0) {\n  const { style } = plan, o =")
s = s.replace("import { SIZES, STYLES, WALL_H, T, FLOOR_Y, DOOR_W, DOOR_H, WIN_W, WIN_Y0, WIN_Y1, WALL_HEIGHT, rnd, planHouse } from './housedata.js';", "import { SIZES, STYLES, WALL_H, T, FLOOR_Y, DOOR_W, DOOR_H, WIN_W, WIN_Y0, WIN_Y1, WALL_HEIGHT, WALL2_H, FLOOR2_Y, STAIR_W, STAIR_L, rnd, planHouse } from './housedata.js';")
s = s.replace("export { SIZES, STYLES, WALL_HEIGHT, planHouse };", "export { SIZES, STYLES, WALL_HEIGHT, planHouse, FLOOR2_Y, WALL2_H };")
open(p, 'w', encoding='utf-8').write(s)
print('ok', 'y0)' in s)
