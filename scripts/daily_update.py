#!/usr/bin/env python3
"""PediaQ daily generator. No access to ChatGPT chat history is assumed."""
import base64, datetime as dt, json, os, pathlib, random, re, sys, time, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
from commons_images import find_option_images
QUESTIONS=ROOT/'questions.json'
INBOX=ROOT/'inbox'/'approved_topics.json'
MODEL=os.getenv('PEDIAQ_TEXT_MODEL','gpt-4o-mini')
IMAGE_MODEL=os.getenv('PEDIAQ_IMAGE_MODEL','gpt-image-1')
KEY=os.getenv('OPENAI_API_KEY')

def api(path, payload, timeout=180):
    req=urllib.request.Request('https://api.openai.com/v1/'+path,data=json.dumps(payload,ensure_ascii=False).encode(),headers={'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=timeout) as response:return json.load(response)

def extract_json(s):
    s=s.strip();s=re.sub(r'^```(?:json)?\s*|\s*```$','',s)
    return json.loads(s)

def validate(q,existing):
    needed=['id','domain','level','ja','en','options','correct','exja','exen','panel_prompts']
    if any(k not in q for k in needed):raise ValueError('Missing required question field')
    if not isinstance(q['id'],str) or not re.fullmatch(r'AUTO-[0-9]{8}-[A-Z0-9]+',q['id']):raise ValueError('Bad ID')
    if q['id'] in existing:raise ValueError('Duplicate ID')
    if len(q['options'])!=4 or any(not isinstance(o,dict) or not o.get('ja') or not o.get('en') for o in q['options']):raise ValueError('Invalid options')
    if type(q['correct']) is not int or q['correct'] not in range(4):raise ValueError('Invalid answer')
    if not isinstance(q['panel_prompts'],list) or len(q['panel_prompts'])!=4 or any(len(x)<30 for x in q['panel_prompts']):raise ValueError('Four distinct scenes required')
    if any(not q[k] or len(str(q[k]))<20 for k in ['ja','en','exja','exen']):raise ValueError('Incomplete bilingual text')
    return q

def choose_topic(today):
    approved=json.loads(INBOX.read_text()) if INBOX.exists() else []
    # Only approved, de-identified notes; never scrape chat logs or patient charts.
    ready=[x for x in approved if x.get('approved') and not x.get('processed') and x.get('topic')]
    if ready:return ready[0],approved
    pediatric=['infantile epileptic spasms syndrome','pediatric febrile UTI and VCUG indications','Kawasaki disease IVIG resistance','neonatal hypoglycemia and hyperinsulinism','pediatric bacterial meningitis','pediatric acute encephalopathy AESD versus ADEM','pediatric asthma controller therapy']
    eiken=['corroborate versus substantiate','supersede versus replace','refute versus rebut','conflate versus confuse','extrapolate versus interpolate','rest on one’s laurels','mitigate versus alleviate']
    pool=pediatric if today.toordinal()%2==0 else eiken
    return {'topic':pool[today.toordinal()%len(pool)],'domain':'Pediatrics' if today.toordinal()%2==0 else 'Eiken1','approved':True,'source':'curated curriculum'},approved

def generate(topic,today,existing):
    suffix='P' if topic.get('domain')!='Eiken1' else 'E'
    qid=f'AUTO-{today.strftime("%Y%m%d")}-{suffix}'
    if qid in existing:print('Already generated:',qid);return None
    prompt=f'''Produce ONE rigorous bilingual Japanese/English five-option question for PediaQ about: {topic['topic']}. Domain {topic.get('domain','Pediatrics')}. Target advanced pediatric residency / Japanese pediatric boards, or Eiken Grade 1 C1-C2. A-D are four plausible distinct choices, E=I don't know is added by the app. Make ONE unequivocal correct answer. Avoid patient-identifiable details, fictional source citations, and absolute-word tricks. Return ONLY JSON object with exact fields: id (exactly {qid}), domain (Pediatrics or Eiken1), level (integer 4 or 5), ja (question Japanese), en (same complete question English), options (4 objects with ja and en), correct (zero-based integer), exja (thorough Japanese explanation of all options, at least 120 Japanese characters), exen (equivalent thorough English explanation of all options, at least 120 English characters), panel_prompts (4 distinct English image scene descriptions, each >=30 chars, one per A-D, vivid different characters/action/background, illustrating what that option means; no answer letters, no medical advice text in image). Do not add Markdown fences. Medical content must be conservative and well-established; uncertain clinical claims should not be generated.'''
    data=api('chat/completions',{'model':MODEL,'temperature':0.3,'response_format':{'type':'json_object'},'messages':[{'role':'system','content':'You are a bilingual pediatric board and Eiken Grade 1 question author. Output valid JSON only.'},{'role':'user','content':prompt}]})
    q=extract_json(data['choices'][0]['message']['content']);return validate(q,existing)

def generate_comic(q):
    scenes='\n'.join(f'Panel {i+1}: {s}' for i,s in enumerate(q['panel_prompts']))
    prompt=f'''Create a polished, colorful, visually clear 2x2 FOUR PANEL MANGA page for a learning quiz. EXACTLY FOUR separate panels, equal size, numbered visually 1-4 if useful. Each panel tells a DISTINCT funny story with different characters, expressive faces, actions, props and backgrounds. No repeated layouts, no plain diagrams, no abstract boxes or arrows. Render educationally accurate depictions; avoid identifiable patients. No captions, no letters A-D, no long text because text will be added as accessible HTML outside the image. Scenes:\n{scenes}'''
    result=api('images/generations',{'model':IMAGE_MODEL,'prompt':prompt,'size':'1024x1024','n':1},timeout=240)
    data=result['data'][0]
    if not data.get('b64_json'):raise ValueError('Image API returned no image bytes; refusing to publish question')
    path=ROOT/'comics'/f"{q['id']}.png";path.parent.mkdir(exist_ok=True)
    path.write_bytes(base64.b64decode(data['b64_json']))
    if path.stat().st_size<10000:raise ValueError('Comic output too small')
    return 'comics/'+path.name

def main():
    if not KEY:raise SystemExit('OPENAI_API_KEY secret is missing; nothing published')
    today=dt.date.today()
    questions=json.loads(QUESTIONS.read_text());existing={q['id'] for q in questions}
    topic,approved=choose_topic(today)
    q=generate(topic,today,existing)
    if q is None:return
    # Default to reusable Commons photos with attribution for each option.
    # If four suitably licensed images cannot be found, generate one manga sheet.
    images=find_option_images(q)
    if images:
        q['images']=images
        print('Selected four Commons images with attribution:',q['id'])
    else:
        q['comic']=generate_comic(q)
        print('Commons coverage incomplete; generated original manga:',q['id'])
    q.pop('panel_prompts')
    questions.append(q)
    temp=QUESTIONS.with_suffix('.json.tmp');temp.write_text(json.dumps(questions,ensure_ascii=False,indent=2)+'\n');temp.replace(QUESTIONS)
    if topic in approved:
        topic['processed']=today.isoformat();INBOX.write_text(json.dumps(approved,ensure_ascii=False,indent=2)+'\n')
    print('Published locally:',q['id'],q['comic'])
if __name__=='__main__':main()
