const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src', 'react-app');

const replacements = {
  // Strip the light background forced gradient that overrides the global body mesh
  'bg-gradient-to-br from-orange-50 via-white to-amber-50': '',
  
  // Convert basic card backgrounds to premium glass
  'bg-white dark:bg-slate-800': 'bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl',
  'bg-white dark:bg-slate-800/80': 'bg-slate-900/40 backdrop-blur-2xl border-white/10 shadow-2xl shadow-black/20',

  // Secondary backgrounds to deeper glass
  'bg-gray-50 dark:bg-slate-900': 'bg-black/40 border border-white/5 shadow-inner',
  'bg-gray-100 dark:bg-slate-800': 'bg-white/5 border border-white/10',
  'bg-slate-50 dark:bg-slate-900': 'bg-black/40 border border-white/5 shadow-inner',

  // Borders
  'border-gray-100 dark:border-slate-700/50': 'border-white/10',
  'border-gray-200 dark:border-slate-700': 'border-white/10',
  'border-gray-300 dark:border-slate-600': 'border-white/20',
  'border-orange-100 dark:border-orange-900/40': 'border-white/10',
  'border border-orange-200': 'border border-white/10',

  // Text
  'text-gray-900 dark:text-slate-100': 'text-white',
  'text-gray-800 dark:text-slate-200': 'text-white',
  'text-gray-700': 'text-slate-200',
  'text-gray-600 dark:text-slate-300': 'text-slate-300',
  'text-gray-500 dark:text-slate-400': 'text-slate-400',
  'text-gray-400': 'text-slate-500',
  
  // Specific buttons / tabs
  'bg-white text-gray-800': 'bg-white/10 text-white hover:bg-white/20',
  'bg-white text-gray-600': 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white',
  'hover:bg-gray-50': 'hover:bg-white/5',
  
  // Accents
  'bg-orange-50': 'bg-orange-500/10',
  'text-orange-600': 'text-orange-400',
  'bg-orange-100 text-orange-600': 'bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/30'
};

function processDirectory(directory) {
  const files = fs.readdirSync(directory);

  for (const file of files) {
    const fullPath = path.join(directory, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('AdminDashboard.tsx') || fullPath.endsWith('StaffRegistration.tsx') || fullPath.endsWith('OrderConfirmation.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const [key, value] of Object.entries(replacements)) {
        // We use split/join for exact substring replacement since Tailwind classes can be tricky with regex 
        // if they contain special characters like /, [, ].
        if (content.includes(key)) {
          content = content.split(key).join(value);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Upgraded to premium aesthetic: ${fullPath}`);
      }
    }
  }
}

processDirectory(targetDir);
console.log('Premium fixup complete.');
