/* Shared approved screenplay formatter; pure rendering, no stored mutations. */
(()=>{
 const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function classify(line){
    const text=line.trim();
    if(!text)return 'blank';
    if(/^(?:СЦЕНА|SCENE)\s+\d+/iu.test(text))return 'scene';
    if(/^(?:ЛОКАЦІЯ|LOCATION|МІСЦЕ|МЕТА СЦЕНИ|ЦІЛЬ СЦЕНИ)\s*:/iu.test(text))return 'detail';
    if(/^(?:[А-ЯІЇЄҐA-Z][А-ЯІЇЄҐA-Zа-яіїєґa-z\s().–—-]{1,40})\s*:\s*.+$/u.test(text))return 'dialogue';
    if(/^\((?:[^)]{1,70})\)$/.test(text))return 'direction';
    if(/^(?:ДІЯ|КАМЕРА|ПЛАН|РУХ КАМЕРИ)\s*:/iu.test(text))return 'action';
    return 'prose';
  }
  function renderLines(text){
    const source=String(text??'').split(/\r?\n/);
    const pieces=[];
    let prose=[];
    let empty=0;
    const flush=()=>{
      if(prose.length){pieces.push('<p class="aps-screenplay-paragraph">'+prose.map(escapeHTML).join(' ')+'</p>');prose=[]}
    };
    for(const raw of source){
      const line=raw.trim(),type=classify(raw);
      if(type==='blank'){empty++;if(empty>=2)flush();continue;}
      empty=0;
      if(type==='prose'){prose.push(line);continue;}
      flush();
      if(type==='scene'){
        pieces.push('<h4 class="aps-screenplay-scene"><span aria-hidden="true">▧</span>'+escapeHTML(line)+'</h4>');
        continue;
      }
      if(type==='detail'){
        const i=line.indexOf(':');
        pieces.push('<p class="aps-screenplay-detail"><strong>'+escapeHTML(line.slice(0,i))+':</strong> '+escapeHTML(line.slice(i+1).trim())+'</p>');
        continue;
      }
      if(type==='dialogue'){
        const i=line.indexOf(':'),speaker=line.slice(0,i).trim(),dialogue=line.slice(i+1).trim();
        const narrator=/^(?:ГОЛОС|VOICE|ОПОВІДАЧ)/iu.test(speaker);
        pieces.push('<section class="aps-screenplay-dialogue '+(narrator?'is-narrator':'')+'"><span class="aps-screenplay-avatar" aria-hidden="true">'+(narrator?'◖':'♙')+'</span><div><strong>'+escapeHTML(speaker)+'</strong><p>'+escapeHTML(dialogue)+'</p></div></section>');
        continue;
      }
      if(type==='direction'){pieces.push('<p class="aps-screenplay-direction">'+escapeHTML(line)+'</p>');continue;}
      pieces.push('<p class="aps-screenplay-action"><span aria-hidden="true">▣</span>'+escapeHTML(line)+'</p>');
    }
    flush();
    return pieces.length?pieces.join(''):'<p class="aps-screenplay-empty">Сценарій поки порожній. Натисни «Редагувати», щоб почати.</p>';
  }


 window.APSApprovedScriptFormat=Object.freeze({classify,renderLines});
})();
