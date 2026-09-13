import fs from 'node:fs/promises';
const url=process.env.LINTECH_URL||'http://127.0.0.1:8080'; let failed=false;
try{const response=await fetch(`${url}/api/health`);const body=await response.json();if(!response.ok||body.status!=='ok')throw new Error('unhealthy response');console.log(`PASS API ${body.version}`);}catch(error){console.error(`FAIL API: ${error.message}`);failed=true;}
if(process.platform==='linux'){for(const item of ['/etc/lintech-panel/panel.env','/var/lib/lintech-panel']){try{await fs.access(item);console.log(`PASS ${item}`);}catch{console.error(`FAIL missing ${item}`);failed=true;}}}else console.log('SKIP Linux service and permission checks on non-Linux host');
process.exitCode=failed?1:0;

