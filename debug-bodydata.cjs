const http = require('http');

http.get('http://localhost:5074/api/FilledForms', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const forms = json['$values'] || json;
    console.log('=== TOTAL FORMS:', forms.length, '===\n');
    
    // Analizar los primeros 5 formularios
    forms.slice(0, 8).forEach((f, fi) => {
      console.log(`\n--- FORM ${fi} ---`);
      console.log(`FormID: ${f.formID} | TemplateID: ${f.templateID} | By: ${f.filledBy}`);
      
      let bd;
      try {
        bd = JSON.parse(f.bodyData || '[]');
      } catch(e) {
        console.log('  ERROR parsing bodyData:', e.message);
        return;
      }
      
      console.log(`bodyData isArray: ${Array.isArray(bd)} | length: ${bd.length}`);
      
      if (Array.isArray(bd)) {
        bd.forEach((table, ti) => {
          console.log(`  Table[${ti}] keys: ${Object.keys(table).join(', ')}`);
          
          // Si tiene "data" array
          if (table.data && Array.isArray(table.data)) {
            console.log(`    data rows: ${table.data.length}`);
            if (table.data[0]) {
              const row0 = table.data[0];
              const keys = Object.keys(row0);
              console.log(`    Row[0] keys: ${keys.join(' | ')}`);
              // Mostrar valores del primer row
              keys.forEach(k => {
                const v = row0[k];
                if (v !== '' && v !== null && v !== undefined) {
                  console.log(`      "${k}": "${v}"`);
                }
              });
            }
          }
          
          // Si tiene "columns" 
          if (table.columns) {
            console.log(`    columns: ${JSON.stringify(table.columns).substring(0, 200)}`);
          }
          
          // Si tiene "rows"
          if (table.rows && Array.isArray(table.rows)) {
            console.log(`    rows: ${table.rows.length}`);
            if (table.rows[0]) {
              console.log(`    Row[0]: ${JSON.stringify(table.rows[0]).substring(0, 200)}`);
            }
          }

          // Mostrar toda la estructura si es pequeña
          const str = JSON.stringify(table);
          if (str.length < 500) {
            console.log(`    FULL: ${str}`);
          }
        });
      } else if (typeof bd === 'object') {
        console.log(`  bodyData object keys: ${Object.keys(bd).join(', ')}`);
        const str = JSON.stringify(bd);
        if (str.length < 500) {
          console.log(`  FULL: ${str}`);
        }
      }
    });
  });
}).on('error', e => console.error('ERROR:', e.message));
