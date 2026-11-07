const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function escapeForPayload(code) {
    return code
        .replace(/&/g, '&amp;amp;')
        .replace(/</g, '&amp;lt;')
        .replace(/>/g, '&amp;gt;')
        .replace(/"/g, '&amp;quot;');
}

const scopedXmlPath = path.resolve('update_sets/now_pilot_scoped.xml');
let xml = fs.readFileSync(scopedXmlPath, 'utf8');

// 1. Update Application menu title
xml = xml.replace(
    /&lt;title&gt;GMG AI Agent&lt;\/title&gt;/g,
    '&lt;title&gt;Now Pilot&lt;/title&gt;'
);

const filesToSync = [
    'DiagnosticService',
    'LLMAdapter',
    'AgentCore',
    'ITSMAssistant',
    'WorkflowPlanner',
    'WorkflowEngine',
    'ITSMContextBuilder',
    'DevAssistant',
    'AgentTools'
];

filesToSync.forEach(name => {
    const srcFile = path.resolve('src/scoped', name + '.js');
    if (!fs.existsSync(srcFile)) {
        console.warn(`File not found: ${srcFile}`);
        return;
    }
    const code = fs.readFileSync(srcFile, 'utf8');
    const escapedCode = escapeForPayload(code);

    const targetTag = `<target_name>${name}</target_name>`;
    const targetIdx = xml.indexOf(targetTag);
    if (targetIdx === -1) {
        console.warn(`Target not found in XML: ${name}`);
        return;
    }

    const startUpdateXml = xml.lastIndexOf('<sys_update_xml action=', targetIdx);
    const endUpdateXml = xml.indexOf('</sys_update_xml>', targetIdx) + '</sys_update_xml>'.length;
    let block = xml.substring(startUpdateXml, endUpdateXml);

    const scriptStartTag = '&lt;script&gt;';
    const scriptEndTag = '&lt;/script&gt;';
    const sStart = block.indexOf(scriptStartTag);
    const sEnd = block.indexOf(scriptEndTag);

    if (sStart === -1 || sEnd === -1) {
        console.warn(`Script tags not found in update block for ${name}`);
        return;
    }

    const newBlock = block.substring(0, sStart + scriptStartTag.length) +
                     escapedCode +
                     block.substring(sEnd);

    xml = xml.substring(0, startUpdateXml) + newBlock + xml.substring(endUpdateXml);
    console.log(`Synced ${name} (${code.length} bytes -> ${escapedCode.length} escaped bytes) into update set`);
});

xml = xml.replace(/\r\n/g, '\n');
fs.writeFileSync(scopedXmlPath, xml, 'utf8');
console.log('Successfully wrote updated update_sets/now_pilot_scoped.xml');

// Recompute SHA256SUMS
const globalPath = 'update_sets/now_pilot_global.xml';
const scopedPath = 'update_sets/now_pilot_scoped.xml';

const globalHash = crypto.createHash('sha256').update(fs.readFileSync(globalPath)).digest('hex');
const scopedHash = crypto.createHash('sha256').update(fs.readFileSync(scopedPath)).digest('hex');

const sha256Content = `${globalHash}  ${globalPath}\n${scopedHash}  ${scopedPath}\n`;
fs.writeFileSync('SHA256SUMS', sha256Content, 'utf8');

console.log('Updated SHA256SUMS:');
console.log(sha256Content);
