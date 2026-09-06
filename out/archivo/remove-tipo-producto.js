const fs = require('fs');
const f = 'c:/Users/fupifigu/Desktop/OPERATIVOS ESTUDIARF/sistemas_operativos/frigo/frigo-fron/src/pages/FillForm.jsx';
const c = fs.readFileSync(f, 'utf8');
const lines = c.split('\n');

let startLine = -1, endLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('SELECTOR DE TIPO DE PRODUCTO')) {
    // Go back to the line with {/* comment start
    startLine = i;
  }
  if (startLine > 0 && i > startLine && lines[i].includes('HEADER FIELDS')) {
    endLine = i;
    break;
  }
}

console.log('Start line:', startLine + 1, 'End line:', endLine + 1);
console.log('Content around start:', lines[startLine]);
console.log('Content at end:', lines[endLine]);

if (startLine > 0 && endLine > 0) {
  // Remove from the comment line (startLine) to just before HEADER FIELDS (endLine-1)  
  // But keep the line before startLine that has the closing )} 
  const newLines = [
    ...lines.slice(0, startLine),
    '',
    ...lines.slice(endLine)
  ];
  fs.writeFileSync(f, newLines.join('\n'), 'utf8');
  console.log('SUCCESS: Removed lines', startLine + 1, 'to', endLine, '(' + (endLine - startLine) + ' lines)');
} else {
  console.log('ERROR: Could not find markers');
}
