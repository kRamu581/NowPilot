import html
import hashlib
import shutil
from pathlib import Path

def escape_for_payload(code):
    return (code
        .replace('&', '&amp;amp;')
        .replace('<', '&amp;lt;')
        .replace('>', '&amp;gt;')
        .replace('"', '&amp;quot;'))

src = Path('src/global/gmg_ai_agent_panel.js').read_text(encoding='utf-8').replace('\r\n', '\n')
xml = Path('update_sets/now_pilot_global.xml').read_text(encoding='utf-8')

target_idx = xml.find('<target_name>gmg_ai_agent_panel</target_name>')
assert target_idx != -1, 'gmg_ai_agent_panel target not found in global XML'

start_update = xml.rfind('<sys_update_xml action=', 0, target_idx)
end_update = xml.find('</sys_update_xml>', target_idx) + len('</sys_update_xml>')
block = xml[start_update:end_update]

script_start_tag = '&lt;script&gt;'
script_end_tag = '&lt;/script&gt;'
s_start = block.find(script_start_tag)
s_end = block.find(script_end_tag)
assert s_start != -1 and s_end != -1, 'script tags not found in update block'

escaped_code = escape_for_payload(src)

new_block = block[:s_start + len(script_start_tag)] + escaped_code + block[s_end:]
new_xml = xml[:start_update] + new_block + xml[end_update:]

Path('update_sets/now_pilot_global.xml').write_text(new_xml, encoding='utf-8')

# update SHA256SUMS
gh = hashlib.sha256(Path('update_sets/now_pilot_global.xml').read_bytes()).hexdigest()
sh = hashlib.sha256(Path('update_sets/now_pilot_scoped.xml').read_bytes()).hexdigest()
Path('SHA256SUMS').write_text(f'{gh}  update_sets/now_pilot_global.xml\n{sh}  update_sets/now_pilot_scoped.xml\n', encoding='utf-8')

print('Successfully embedded gmg_ai_agent_panel.js into now_pilot_global.xml and gmg_ai_agent_global.xml')
print('New global SHA256:', gh)
