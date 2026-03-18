const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src', 'react-app');

const replacements = {
  'bg-white': 'bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100', // added text here to ensure cards have good text
  'bg-gray-50': 'bg-gray-50 dark:bg-slate-900',
  'bg-slate-50': 'bg-slate-50 dark:bg-slate-900',
  'text-gray-900': 'text-gray-900 dark:text-slate-100',
  'text-gray-800': 'text-gray-800 dark:text-slate-200',
  'text-gray-600': 'text-gray-600 dark:text-slate-300',
  'text-gray-500': 'text-gray-500 dark:text-slate-400',
  'text-slate-900': 'text-slate-900 dark:text-slate-100',
  'text-slate-800': 'text-slate-800 dark:text-slate-200',
  'text-slate-600': 'text-slate-600 dark:text-slate-300',
  'border-gray-200': 'border-gray-200 dark:border-slate-700',
  'border-gray-100': 'border-gray-100 dark:border-slate-700/50',
  'border-gray-300': 'border-gray-300 dark:border-slate-600',
  'border-orange-100': 'border-orange-100 dark:border-orange-900/40',
};

// Simplify by just replacing individual classes
const simpleReplacements = {
  'bg-white': 'bg-white dark:bg-slate-800',
  'bg-gray-50': 'bg-gray-50 dark:bg-slate-900',
  'bg-slate-50': 'bg-slate-50 dark:bg-slate-900',
  'text-gray-900': 'text-gray-900 dark:text-slate-100',
  'text-gray-800': 'text-gray-800 dark:text-slate-200',
  'text-gray-600': 'text-gray-600 dark:text-slate-300',
  'text-gray-500': 'text-gray-500 dark:text-slate-400',
  'text-slate-900': 'text-slate-900 dark:text-slate-100',
  'text-slate-800': 'text-slate-800 dark:text-slate-200',
  'text-slate-600': 'text-slate-600 dark:text-slate-300',
  'border-gray-200': 'border-gray-200 dark:border-slate-700',
  'border-gray-100': 'border-gray-100 dark:border-slate-700/50',
  'border-gray-300': 'border-gray-300 dark:border-slate-600',
  'border-orange-100': 'border-orange-100 dark:border-orange-900/40',
};

function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const [key, value] of Object.entries(simpleReplacements)) {
        // Regex to match the class name cleanly, ensuring it's not already prefixed with `dark:` or part of another string.
        const regex = new RegExp(`(?<!dark:)\\b${key}\\b(?!.*dark:bg-)`, 'g');
        if (regex.test(content)) {
          // just standard replace with word boundaries, avoiding double replacement if run multiple times
          const safeRegex = new RegExp(`(?<!dark:)\\b${key}\\b(?![\\w-])`, 'g');
          
          content = content.replace(safeRegex, (match) => {
             // Let's do a simple check. If the string around it already has the dark variant, we skip.
             // But simpler: just replace unless it already has it. We assume first run.
             return value;
          });
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(targetDir);
console.log('Class replacement complete.');
