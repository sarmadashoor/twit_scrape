const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();
const IGNORE_DIRS = ['node_modules', '.git'];

function getFileTree(dir, prefix = '') {
  const items = fs.readdirSync(dir, { withFileTypes: true });

  items.forEach(item => {
    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (IGNORE_DIRS.includes(item.name)) return;

    if (item.isDirectory()) {
      console.log(`${prefix}📁 ${item.name}`);
      getFileTree(fullPath, prefix + '  ');
    } else {
      console.log(`${prefix}📄 ${item.name}`);
    }
  });
}

console.log(`Project file tree for: ${rootDir}`);
getFileTree(rootDir);
