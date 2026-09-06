// Script to remove tipoProducto section from FillForm.jsx
const fs = require('fs');
const path = 'src/pages/FillForm.jsx';

let content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Find the start: line containing "SELECTOR DE TIPO DE PRODUCTO"
let startLine = -1;
let endLine = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('SELECTOR DE TIPO DE PRODUCTO')) {
    startLine = i;
    console.log('Found start at line', i + 1, ':', lines[i].trim().substring(0, 60));
  }
  if (startLine >= 0 && i > startLine + 5 && lines[i].includes('{/* HEADER FIELDS')) {
    endLine = i;
    console.log('Found end at line', i + 1, ':', lines[i].trim().substring(0, 60));
    break;
  }
}

if (startLine >= 0 && endLine >= 0) {
  // Remove from startLine to endLine-1 (keep the HEADER FIELDS line)
  const newLines = [
    ...lines.slice(0, startLine),
    ...lines.slice(endLine)
  ];
  fs.writeFileSync(path, newLines.join('\n'), 'utf8');
  console.log('Removed', endLine - startLine, 'lines (from line', startLine + 1, 'to', endLine, ')');
  console.log('File saved successfully!');
} else {
  console.log('ERROR: Could not find markers. startLine:', startLine, 'endLine:', endLine);
}
