const fs = require('fs');
const data = JSON.parse(fs.readFileSync('runs.json', 'utf16le'));
console.log(`Total runs: ${data.total_count}`);
for (const run of data.workflow_runs.slice(0, 3)) {
    console.log(`${run.name}: status=${run.status}, conclusion=${run.conclusion}`);
}
