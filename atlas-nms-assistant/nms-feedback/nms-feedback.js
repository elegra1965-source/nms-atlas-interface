/* ============================================================
   NMS Hub family — Reviews & feedback pop-up, shared version (2026-10-31, Tony).
   The same file on Weather, Translator, Theme Pack, ATLAS and the Galactic Map
   (the Hub keeps its own feedback.js, which also feeds its live strip).

   Everything goes to the Hub's feedback function
   (https://nomansskyhub.app/.netlify/functions/feedback, CORS for *.nomansskyhub.app),
   so Tony gets the same email + inbox whichever site it came from.

   USE
     <script src="/nms-feedback.js?v=20261031" data-tool="weather" defer></script>
     any element with  data-nms-feedback  opens it; a <span data-fbt="REVIEWS & FEEDBACK">
     inside it is translated by this file (class nms-fb-btn / nms-fb-ico style the button + icon); (data-nms-feedback="reviews"
     opens the "What travellers say" tab). JS: NMSFeedback.open() / .openReviews() / .close()
   - data-tool = this site's chip, ticked when the pop-up opens.
   - Own CSS (injected, colours scoped on #fbDlg) and own words for the 7 languages
     (taken from the Hub packs), so it doesn't depend on the site's packs or sw cache.
     Other languages fall back to NMS_T, then English.
   - Icons: fb-ico-*.webp next to this file (Tony's own low-poly pictures).
   - Bug reports add device type, browser, screen size and this site's cache version.
   X, tapping outside, Esc and the phone's Back button close it.
   ============================================================ */
(function () {
  'use strict';
  if (window.NMSFeedback) return;
  var API = 'https://nomansskyhub.app/.netlify/functions/feedback';
  var me = document.currentScript;
  var BASE = me && me.src ? me.src.replace(/[^\/?#]*([?#].*)?$/, '') : '/';
  var SITE = (me && me.getAttribute('data-tool')) || '';
  var CACHE_RE = { map: /^nms-galmap-/, atlas: /^atlas-/, weather: /^nms-weather-/, translator: /^nms-alphabet-/, theme: /^nms-icon-pack-/ }[SITE] || /^nms-/;
  var TOOLS = [['hub', 'Hub'], ['map', 'Galactic Map'], ['atlas', 'ATLAS'], ['weather', 'Weather'], ['translator', 'Translator'], ['theme', 'Theme Pack']];
  var TNAME = {}; TOOLS.forEach(function (t) { TNAME[t[0]] = t[1]; });
  var DICT = {"es":{"◆ REVIEWS & FEEDBACK":"◆ OPINIONES Y COMENTARIOS","★ REVIEWS & FEEDBACK":"★ OPINIONES Y COMENTARIOS","★ REVIEWS":"★ OPINIONES","SEND FEEDBACK":"ENVIAR COMENTARIO","WHAT TRAVELLERS SAY":"LO QUE DICEN LOS VIAJEROS","Review":"Opinión","Bug":"Error","Idea / request":"Idea / petición","WHICH TOOLS HAVE YOU USED?":"¿QUÉ HERRAMIENTAS HAS USADO?","WHICH TOOL?":"¿QUÉ HERRAMIENTA?","(TAP ALL THAT APPLY)":"(TOCA TODAS LAS QUE CORRESPONDAN)","RATING":"VALORACIÓN","(OPTIONAL)":"(OPCIONAL)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"¿QUÉ TE GUSTA O QUÉ PODRÍA MEJORAR?","WHAT WENT WRONG?":"¿QUÉ HA FALLADO?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"¿QUÉ TE GUSTARÍA AÑADIR O CAMBIAR?","Tell us anything: a favourite feature, something to improve…":"Cuéntanos lo que sea: tu función favorita, algo que mejorar…","What did you tap, and what happened?":"¿Qué tocaste y qué pasó?","Describe your idea…":"Describe tu idea…","YOUR NAME":"TU NOMBRE","Traveller, Reddit or Discord name":"Nombre de viajero, Reddit o Discord","OK to show this on the site (with my name, if given)":"Se puede mostrar en la web (con mi nombre, si lo he puesto)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Se añaden tu tipo de dispositivo y navegador para arreglarlo antes. Nada personal.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 lee todos los mensajes. Nada aparece en la web sin su visto bueno.","SEND":"ENVIAR","SENDING…":"ENVIANDO…","TRANSMISSION RECEIVED":"TRANSMISIÓN RECIBIDA","Thanks, traveller. Your feedback has been sent.":"Gracias, viajero. Tu comentario se ha enviado.","SEND ANOTHER":"ENVIAR OTRO","CLOSE":"CERRAR","Close":"Cerrar","Couldn't send. Check your connection and try again.":"No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.","Too many sends. Try again in an hour.":"Demasiados envíos. Inténtalo dentro de una hora.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Aún no hay opiniones. Sé el primero: elige Opinión, escribe unas palabras y activa «Se puede mostrar».","✎ WRITE YOUR OWN":"✎ ESCRIBE LA TUYA","Loading…":"Cargando…","Send a review, report a bug or ask for something new":"Deja una opinión, informa de un error o pide algo nuevo","Translator":"Traductor","Reviews & feedback":"Opiniones y comentarios","WHAT'S IT ABOUT, TRAVELLER?":"¿DE QUÉ SE TRATA, VIAJERO?","A traveller":null,"REVIEWS & FEEDBACK":"OPINIONES Y COMENTARIOS"},"de":{"◆ REVIEWS & FEEDBACK":"◆ BEWERTUNGEN & FEEDBACK","★ REVIEWS & FEEDBACK":"★ BEWERTUNGEN & FEEDBACK","★ REVIEWS":"★ BEWERTUNGEN","SEND FEEDBACK":"FEEDBACK SENDEN","WHAT TRAVELLERS SAY":"WAS REISENDE SAGEN","Review":"Bewertung","Bug":"Fehler","Idea / request":"Idee / Wunsch","WHICH TOOLS HAVE YOU USED?":"WELCHE TOOLS HAST DU BENUTZT?","WHICH TOOL?":"WELCHES TOOL?","(TAP ALL THAT APPLY)":"(ALLES ZUTREFFENDE ANTIPPEN)","RATING":"BEWERTUNG","(OPTIONAL)":"(OPTIONAL)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"WAS GEFÄLLT DIR, WAS KÖNNTE BESSER SEIN?","WHAT WENT WRONG?":"WAS IST SCHIEFGELAUFEN?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"WAS SOLL HINZUKOMMEN ODER SICH ÄNDERN?","Tell us anything: a favourite feature, something to improve…":"Erzähl uns alles: Lieblingsfunktion, etwas zum Verbessern…","What did you tap, and what happened?":"Was hast du angetippt, und was ist passiert?","Describe your idea…":"Beschreib deine Idee…","YOUR NAME":"DEIN NAME","Traveller, Reddit or Discord name":"Reisenden-, Reddit- oder Discord-Name","OK to show this on the site (with my name, if given)":"Darf auf der Seite gezeigt werden (mit meinem Namen, falls angegeben)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Gerätetyp und Browser werden mitgeschickt, damit es schneller behoben wird. Nichts Persönliches.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 liest jede Nachricht. Nichts erscheint ohne sein OK auf der Seite.","SEND":"SENDEN","SENDING…":"WIRD GESENDET…","TRANSMISSION RECEIVED":"ÜBERTRAGUNG EMPFANGEN","Thanks, traveller. Your feedback has been sent.":"Danke, Reisender. Dein Feedback wurde gesendet.","SEND ANOTHER":"NOCH EINS SENDEN","CLOSE":"SCHLIESSEN","Close":"Schließen","Couldn't send. Check your connection and try again.":"Senden fehlgeschlagen. Prüfe deine Verbindung und versuch es nochmal.","Too many sends. Try again in an hour.":"Zu viele Nachrichten. Versuch es in einer Stunde wieder.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Noch keine Bewertungen. Sei der Erste: Bewertung wählen, ein paar Worte schreiben und „Darf gezeigt werden“ einschalten.","✎ WRITE YOUR OWN":"✎ SCHREIB DEINE EIGENE","Loading…":"Wird geladen…","Send a review, report a bug or ask for something new":"Bewertung schreiben, Fehler melden oder etwas Neues wünschen","Translator":"Übersetzer","Reviews & feedback":"Bewertungen & Feedback","WHAT'S IT ABOUT, TRAVELLER?":"WORUM GEHT ES, REISENDER?","A traveller":null,"REVIEWS & FEEDBACK":"BEWERTUNGEN & FEEDBACK"},"nl":{"◆ REVIEWS & FEEDBACK":"◆ REVIEWS & FEEDBACK","★ REVIEWS & FEEDBACK":"★ REVIEWS & FEEDBACK","★ REVIEWS":"★ REVIEWS","SEND FEEDBACK":"FEEDBACK STUREN","WHAT TRAVELLERS SAY":"WAT REIZIGERS ZEGGEN","Review":"Review","Bug":"Bug","Idea / request":"Idee / verzoek","WHICH TOOLS HAVE YOU USED?":"WELKE TOOLS HEB JE GEBRUIKT?","WHICH TOOL?":"WELKE TOOL?","(TAP ALL THAT APPLY)":"(TIK ALLES AAN WAT VAN TOEPASSING IS)","RATING":"BEOORDELING","(OPTIONAL)":"(OPTIONEEL)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"WAT VIND JE GOED, OF WAT KAN BETER?","WHAT WENT WRONG?":"WAT GING ER MIS?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"WAT WIL JE TOEGEVOEGD OF VERANDERD ZIEN?","Tell us anything: a favourite feature, something to improve…":"Vertel ons alles: een favoriete functie, iets om te verbeteren…","What did you tap, and what happened?":"Waar tikte je op, en wat gebeurde er?","Describe your idea…":"Beschrijf je idee…","YOUR NAME":"JE NAAM","Traveller, Reddit or Discord name":"Reizigers-, Reddit- of Discord-naam","OK to show this on the site (with my name, if given)":"Mag op de site getoond worden (met mijn naam, als ingevuld)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Je apparaattype en browser worden meegestuurd zodat het sneller opgelost wordt. Niets persoonlijks.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 leest elk bericht. Niets komt op de site zonder zijn OK.","SEND":"STUREN","SENDING…":"VERSTUREN…","TRANSMISSION RECEIVED":"TRANSMISSIE ONTVANGEN","Thanks, traveller. Your feedback has been sent.":"Bedankt, reiziger. Je feedback is verstuurd.","SEND ANOTHER":"NOG EEN STUREN","CLOSE":"SLUITEN","Close":"Sluiten","Couldn't send. Check your connection and try again.":"Versturen mislukt. Controleer je verbinding en probeer het opnieuw.","Too many sends. Try again in an hour.":"Te veel berichten. Probeer het over een uur opnieuw.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Nog geen reviews. Wees de eerste: kies Review, schrijf een paar woorden en zet 'Mag getoond worden' aan.","✎ WRITE YOUR OWN":"✎ SCHRIJF JE EIGEN","Loading…":"Laden…","Send a review, report a bug or ask for something new":"Schrijf een review, meld een bug of vraag iets nieuws","Translator":"Vertaler","Reviews & feedback":"Reviews & feedback","WHAT'S IT ABOUT, TRAVELLER?":"WAAR GAAT HET OVER, REIZIGER?","A traveller":null,"REVIEWS & FEEDBACK":"REVIEWS & FEEDBACK"},"pl":{"◆ REVIEWS & FEEDBACK":"◆ OPINIE I UWAGI","★ REVIEWS & FEEDBACK":"★ OPINIE I UWAGI","★ REVIEWS":"★ OPINIE","SEND FEEDBACK":"WYŚLIJ UWAGI","WHAT TRAVELLERS SAY":"CO MÓWIĄ PODRÓŻNICY","Review":"Opinia","Bug":"Błąd","Idea / request":"Pomysł / prośba","WHICH TOOLS HAVE YOU USED?":"Z KTÓRYCH NARZĘDZI KORZYSTASZ?","WHICH TOOL?":"KTÓRE NARZĘDZIE?","(TAP ALL THAT APPLY)":"(ZAZNACZ WSZYSTKIE PASUJĄCE)","RATING":"OCENA","(OPTIONAL)":"(OPCJONALNIE)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"CO CI SIĘ PODOBA, A CO MOGŁOBY BYĆ LEPSZE?","WHAT WENT WRONG?":"CO POSZŁO NIE TAK?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"CO CHCESZ DODAĆ LUB ZMIENIĆ?","Tell us anything: a favourite feature, something to improve…":"Napisz cokolwiek: ulubiona funkcja, coś do poprawy…","What did you tap, and what happened?":"Co kliknąłeś i co się stało?","Describe your idea…":"Opisz swój pomysł…","YOUR NAME":"TWOJE IMIĘ","Traveller, Reddit or Discord name":"Nazwa podróżnika, z Reddita lub Discorda","OK to show this on the site (with my name, if given)":"Można pokazać to na stronie (z moim imieniem, jeśli podane)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Dołączamy typ urządzenia i przeglądarkę, żeby szybciej to naprawić. Nic osobistego.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 czyta każdą wiadomość. Nic nie trafi na stronę bez jego zgody.","SEND":"WYŚLIJ","SENDING…":"WYSYŁANIE…","TRANSMISSION RECEIVED":"TRANSMISJA ODEBRANA","Thanks, traveller. Your feedback has been sent.":"Dzięki, podróżniku. Twoja wiadomość została wysłana.","SEND ANOTHER":"WYŚLIJ KOLEJNĄ","CLOSE":"ZAMKNIJ","Close":"Zamknij","Couldn't send. Check your connection and try again.":"Nie udało się wysłać. Sprawdź połączenie i spróbuj ponownie.","Too many sends. Try again in an hour.":"Za dużo wiadomości. Spróbuj za godzinę.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Brak opinii. Bądź pierwszy: wybierz Opinia, napisz kilka słów i włącz „Można pokazać”.","✎ WRITE YOUR OWN":"✎ NAPISZ SWOJĄ","Loading…":"Ładowanie…","Send a review, report a bug or ask for something new":"Napisz opinię, zgłoś błąd albo poproś o coś nowego","Translator":"Tłumacz","Reviews & feedback":"Opinie i uwagi","WHAT'S IT ABOUT, TRAVELLER?":"CZEGO TO DOTYCZY, PODRÓŻNIKU?","A traveller":null,"REVIEWS & FEEDBACK":"OPINIE I UWAGI"},"fr":{"◆ REVIEWS & FEEDBACK":"◆ AVIS & RETOURS","★ REVIEWS & FEEDBACK":"★ AVIS & RETOURS","★ REVIEWS":"★ AVIS","SEND FEEDBACK":"ENVOYER UN RETOUR","WHAT TRAVELLERS SAY":"CE QUE DISENT LES VOYAGEURS","Review":"Avis","Bug":"Bug","Idea / request":"Idée / demande","WHICH TOOLS HAVE YOU USED?":"QUELS OUTILS AS-TU UTILISÉS ?","WHICH TOOL?":"QUEL OUTIL ?","(TAP ALL THAT APPLY)":"(TOUCHE TOUT CE QUI S'APPLIQUE)","RATING":"NOTE","(OPTIONAL)":"(FACULTATIF)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"QU'EST-CE QUI TE PLAÎT, OU QUI POURRAIT ÊTRE MIEUX ?","WHAT WENT WRONG?":"QU'EST-CE QUI N'A PAS MARCHÉ ?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"QUE VOUDRAIS-TU AJOUTER OU CHANGER ?","Tell us anything: a favourite feature, something to improve…":"Dis-nous tout : ta fonction préférée, un point à améliorer…","What did you tap, and what happened?":"Qu'as-tu touché, et que s'est-il passé ?","Describe your idea…":"Décris ton idée…","YOUR NAME":"TON NOM","Traveller, Reddit or Discord name":"Nom de voyageur, Reddit ou Discord","OK to show this on the site (with my name, if given)":"OK pour l'afficher sur le site (avec mon nom, s'il est indiqué)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Ton type d'appareil et ton navigateur sont ajoutés pour corriger plus vite. Rien de personnel.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 lit chaque message. Rien n'est publié sur le site sans son accord.","SEND":"ENVOYER","SENDING…":"ENVOI…","TRANSMISSION RECEIVED":"TRANSMISSION REÇUE","Thanks, traveller. Your feedback has been sent.":"Merci, voyageur. Ton retour a été envoyé.","SEND ANOTHER":"EN ENVOYER UN AUTRE","CLOSE":"FERMER","Close":"Fermer","Couldn't send. Check your connection and try again.":"Envoi impossible. Vérifie ta connexion et réessaie.","Too many sends. Try again in an hour.":"Trop d'envois. Réessaie dans une heure.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Pas encore d'avis. Sois le premier : choisis Avis, écris quelques mots et active « OK pour l'afficher ».","✎ WRITE YOUR OWN":"✎ ÉCRIS LE TIEN","Loading…":"Chargement…","Send a review, report a bug or ask for something new":"Laisse un avis, signale un bug ou demande quelque chose de nouveau","Translator":"Traducteur","Reviews & feedback":"Avis & retours","WHAT'S IT ABOUT, TRAVELLER?":"DE QUOI S'AGIT-IL, VOYAGEUR ?","A traveller":null,"REVIEWS & FEEDBACK":"AVIS & RETOURS"},"pt-BR":{"◆ REVIEWS & FEEDBACK":"◆ AVALIAÇÕES E FEEDBACK","★ REVIEWS & FEEDBACK":"★ AVALIAÇÕES E FEEDBACK","★ REVIEWS":"★ OPINIÕES","SEND FEEDBACK":"ENVIAR FEEDBACK","WHAT TRAVELLERS SAY":"O QUE OS VIAJANTES DIZEM","Review":"Avaliação","Bug":"Bug","Idea / request":"Ideia / pedido","WHICH TOOLS HAVE YOU USED?":"QUAIS FERRAMENTAS VOCÊ USOU?","WHICH TOOL?":"QUAL FERRAMENTA?","(TAP ALL THAT APPLY)":"(TOQUE EM TODAS QUE SE APLICAM)","RATING":"NOTA","(OPTIONAL)":"(OPCIONAL)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"O QUE VOCÊ GOSTA, OU O QUE PODERIA MELHORAR?","WHAT WENT WRONG?":"O QUE DEU ERRADO?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"O QUE VOCÊ GOSTARIA DE ADICIONAR OU MUDAR?","Tell us anything: a favourite feature, something to improve…":"Conte o que quiser: um recurso favorito, algo a melhorar…","What did you tap, and what happened?":"O que você tocou, e o que aconteceu?","Describe your idea…":"Descreva sua ideia…","YOUR NAME":"SEU NOME","Traveller, Reddit or Discord name":"Nome de viajante, Reddit ou Discord","OK to show this on the site (with my name, if given)":"Pode mostrar no site (com meu nome, se informado)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Seu tipo de aparelho e navegador são incluídos para corrigir mais rápido. Nada pessoal.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 lê todas as mensagens. Nada vai para o site sem o OK dele.","SEND":"ENVIAR","SENDING…":"ENVIANDO…","TRANSMISSION RECEIVED":"TRANSMISSÃO RECEBIDA","Thanks, traveller. Your feedback has been sent.":"Valeu, viajante. Seu feedback foi enviado.","SEND ANOTHER":"ENVIAR OUTRO","CLOSE":"FECHAR","Close":"Fechar","Couldn't send. Check your connection and try again.":"Não foi possível enviar. Verifique sua conexão e tente de novo.","Too many sends. Try again in an hour.":"Envios demais. Tente de novo em uma hora.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Ainda não há avaliações. Seja o primeiro: escolha Avaliação, escreva algumas palavras e ative “Pode mostrar”.","✎ WRITE YOUR OWN":"✎ ESCREVA A SUA","Loading…":"Carregando…","Send a review, report a bug or ask for something new":"Deixe uma avaliação, informe um bug ou peça algo novo","Translator":"Tradutor","Reviews & feedback":"Avaliações e feedback","WHAT'S IT ABOUT, TRAVELLER?":"SOBRE O QUE É, VIAJANTE?","A traveller":null,"REVIEWS & FEEDBACK":"AVALIAÇÕES E FEEDBACK"},"it":{"◆ REVIEWS & FEEDBACK":"◆ RECENSIONI E FEEDBACK","★ REVIEWS & FEEDBACK":"★ RECENSIONI E FEEDBACK","★ REVIEWS":"★ RECENSIONI","SEND FEEDBACK":"INVIA FEEDBACK","WHAT TRAVELLERS SAY":"COSA DICONO I VIAGGIATORI","Review":"Recensione","Bug":"Bug","Idea / request":"Idea / richiesta","WHICH TOOLS HAVE YOU USED?":"QUALI STRUMENTI HAI USATO?","WHICH TOOL?":"QUALE STRUMENTO?","(TAP ALL THAT APPLY)":"(TOCCA TUTTE QUELLE CHE VALGONO)","RATING":"VALUTAZIONE","(OPTIONAL)":"(FACOLTATIVO)","WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?":"COSA TI PIACE, O COSA POTREBBE ESSERE MIGLIORE?","WHAT WENT WRONG?":"COSA È ANDATO STORTO?","WHAT WOULD YOU LIKE ADDED OR CHANGED?":"COSA VORRESTI AGGIUNGERE O CAMBIARE?","Tell us anything: a favourite feature, something to improve…":"Raccontaci tutto: una funzione preferita, qualcosa da migliorare…","What did you tap, and what happened?":"Cosa hai toccato e cosa è successo?","Describe your idea…":"Descrivi la tua idea…","YOUR NAME":"IL TUO NOME","Traveller, Reddit or Discord name":"Nome da viaggiatore, Reddit o Discord","OK to show this on the site (with my name, if given)":"OK a mostrarlo sul sito (con il mio nome, se indicato)","Your device type and browser are added so it can be fixed faster. Nothing personal.":"Tipo di dispositivo e browser vengono aggiunti per risolvere prima. Niente di personale.","elegra1965 reads every message. Nothing goes on the site without his OK.":"elegra1965 legge ogni messaggio. Niente va sul sito senza il suo OK.","SEND":"INVIA","SENDING…":"INVIO…","TRANSMISSION RECEIVED":"TRASMISSIONE RICEVUTA","Thanks, traveller. Your feedback has been sent.":"Grazie, viaggiatore. Il tuo feedback è stato inviato.","SEND ANOTHER":"INVIANE UN ALTRO","CLOSE":"CHIUDI","Close":"Chiudi","Couldn't send. Check your connection and try again.":"Invio non riuscito. Controlla la connessione e riprova.","Too many sends. Try again in an hour.":"Troppi invii. Riprova tra un'ora.","No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.":"Ancora nessuna recensione. Sii il primo: scegli Recensione, scrivi due parole e attiva “OK a mostrarlo”.","✎ WRITE YOUR OWN":"✎ SCRIVI LA TUA","Loading…":"Caricamento…","Send a review, report a bug or ask for something new":"Lascia una recensione, segnala un bug o chiedi qualcosa di nuovo","Translator":"Traduttore","Reviews & feedback":"Recensioni e feedback","WHAT'S IT ABOUT, TRAVELLER?":"COSA CI DICI, VIAGGIATORE?","A traveller":null,"REVIEWS & FEEDBACK":"RECENSIONI E FEEDBACK"}};
  function lang() { return (window.NMS_LANG && window.NMS_LANG()) || 'en'; }
  function T(s, v) {
    var l = lang(), o = DICT[l] && DICT[l][s];
    if (o == null) o = window.NMS_T ? window.NMS_T(s, v) : s;
    if (v) for (var k in v) o = String(o).split('{' + k + '}').join(v[k]);
    return o;
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var CSS =
'#fbDlg{--fc:#00e5ff;--fbg:#0a1424;--fhud:#000a16;--fpanel:rgba(255,255,255,.035);--fb:rgba(0,229,255,.16);--fbs:rgba(255,255,255,.1);--ft:#cfe0f0;--fdim:rgba(207,224,240,.62);--fw:#eaf6ff;--fon:#00131a;--fgold:#f0a500;--fred:#ff3322;' +
  '--fdisp:Orbitron,monospace;--fbody:Rajdhani,system-ui,sans-serif;--fmono:"Share Tech Mono",ui-monospace,monospace;' +
  'position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,12,.88);font-family:var(--fbody);line-height:1.45;text-align:left;box-sizing:border-box}' +
'#fbDlg *,#fbDlg *::before,#fbDlg *::after{box-sizing:border-box}' +
'#fbDlg.show{display:flex}' +
'#fbBox{position:relative;width:100%;max-width:460px;max-height:100%;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(0,229,255,.45) transparent;overscroll-behavior:contain;background:var(--fbg);border:1px solid var(--fb);border-radius:10px;padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 0 30px rgba(0,229,255,.08);color:var(--ft);font-size:17px}' +
'#fbBox [hidden]{display:none!important}' +
'#fbBox::-webkit-scrollbar{width:4px;height:0}#fbBox::-webkit-scrollbar-track{background:transparent}#fbBox::-webkit-scrollbar-thumb{background:rgba(0,229,255,.45);border-radius:4px}' +
'#fbBox::before,#fbBox::after{content:"";position:absolute;width:14px;height:14px;border:2px solid var(--fc);pointer-events:none}' +
'#fbBox::before{top:-1px;left:-1px;border-right:0;border-bottom:0;border-top-left-radius:10px}' +
'#fbBox::after{bottom:-1px;right:-1px;border-left:0;border-top:0;border-bottom-right-radius:10px}' +
'#fbDlg .fb-head{display:flex;align-items:center;justify-content:space-between;gap:10px}' +
'#fbDlg .fb-kick{font-family:var(--fmono);font-size:.72rem;letter-spacing:4px;color:var(--fgold)}' +
'#fbClose{flex:none;background:none;border:1px solid var(--fbs);border-radius:6px;color:var(--fc);font-size:1.1rem;line-height:1;width:40px;height:40px;padding:0;cursor:pointer}' +
'#fbClose:hover{border-color:var(--fc)}' +
'#fbDlg .fb-tabs{display:flex;gap:6px}' +
'#fbDlg .fb-tabs button{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:var(--fdim);font-family:var(--fmono);font-size:.66rem;letter-spacing:2px;padding:8px 0;cursor:pointer;border-radius:0}' +
'#fbDlg .fb-tabs button[aria-selected="true"]{color:var(--fc);border-color:var(--fc)}' +
'#fbDlg button:focus-visible{outline:1px solid var(--fc);outline-offset:2px}' +
'#fbDlg .fb-form{display:flex;flex-direction:column;gap:14px;margin:0}' +
'#fbDlg .fb-lbl{font-family:var(--fmono);font-size:.66rem;letter-spacing:2px;color:var(--fdim);margin:0 0 6px;text-transform:none}' +
'#fbDlg .fb-lbl small{opacity:.75;letter-spacing:1px;font-size:inherit}' +
'#fbDlg .fb-chips{display:flex;flex-wrap:wrap;gap:6px}' +
'#fbDlg .fb-chips label{position:relative;cursor:pointer;margin:0}' +
'#fbDlg .fb-chips input{position:absolute;opacity:0;width:1px;height:1px;margin:0}' +
'#fbDlg .fb-chips span{display:inline-block;border:1px solid var(--fbs);border-radius:999px;padding:7px 11px;font-family:var(--fbody);font-size:.92rem;font-weight:600;color:var(--ft);transition:background .15s,border-color .15s,color .15s}' +
'#fbDlg .fb-type span{display:inline-flex;align-items:center;gap:6px}' +
'#fbDlg .fb-ico{width:24px;height:24px;margin:-3px 0;flex:none;object-fit:contain}' +
'#fbDlg .fb-chips input:checked+span{border-color:var(--fc);background:rgba(0,229,255,.12);color:var(--fw)}' +
'#fbDlg .fb-type input[value="bug"]:checked+span{border-color:var(--fred);background:rgba(255,51,34,.12)}' +
'#fbDlg .fb-type input[value="idea"]:checked+span{border-color:var(--fgold);background:rgba(240,165,0,.12)}' +
'#fbDlg .fb-chips input:focus-visible+span{outline:1px solid var(--fc);outline-offset:2px}' +
'#fbDlg .fb-stars{display:flex;gap:4px}' +
'#fbDlg .fb-stars button{background:none;border:0;padding:2px 3px;font-size:1.6rem;line-height:1;color:rgba(207,224,240,.25);cursor:pointer}' +
'#fbDlg .fb-stars button.on{color:var(--fgold);text-shadow:0 0 8px rgba(240,165,0,.5)}' +
'#fbDlg .fb-ta,#fbDlg .fb-in{display:block;width:100%;margin:0;background:var(--fhud);border:1px solid var(--fbs);border-radius:6px;color:var(--fw);font-family:var(--fbody);font-size:1rem;padding:10px 12px;box-shadow:none}' +
'#fbDlg .fb-ta{min-height:96px;resize:vertical}' +
'#fbDlg .fb-ta:focus,#fbDlg .fb-in:focus{outline:none;border-color:var(--fc)}' +
'#fbDlg .fb-count{text-align:right;font-family:var(--fmono);font-size:.62rem;letter-spacing:1px;color:var(--fdim);margin-top:4px}' +
'#fbDlg .fb-sw{display:flex;align-items:flex-start;gap:10px;cursor:pointer;font-size:.95rem;color:var(--ft);margin:0}' +
'#fbDlg .fb-sw input{appearance:none;-webkit-appearance:none;flex:none;width:38px;height:22px;border-radius:11px;background:rgba(255,255,255,.12);position:relative;cursor:pointer;margin:1px 0 0;border:0;transition:background .2s}' +
'#fbDlg .fb-sw input::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--ft);transition:left .2s}' +
'#fbDlg .fb-sw input:checked{background:var(--fc)}#fbDlg .fb-sw input:checked::after{left:19px;background:var(--fon)}' +
'#fbDlg .fb-sw input:focus-visible{outline:1px solid var(--fc);outline-offset:2px}' +
'#fbDlg .fb-note{font-size:.82rem;color:var(--fdim);margin:0}' +
'#fbDlg .fb-err{font-size:.88rem;color:var(--fred);margin:0}' +
'#fbDlg .fb-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
'#fbDlg .fb-send{width:100%;padding:14px;border-radius:8px;border:0;background:var(--fc);color:var(--fon);font-family:var(--fdisp);font-size:.74rem;font-weight:700;letter-spacing:2px;cursor:pointer}' +
'#fbDlg .fb-send:disabled{opacity:.4;cursor:default}' +
'#fbDlg .fb-done{text-align:center;padding:18px 4px 6px;display:flex;flex-direction:column;gap:10px;align-items:center}' +
'#fbDlg .fb-done .tick{width:56px;height:56px;border:2px solid var(--fc);border-radius:50%;display:grid;place-items:center;color:var(--fc);font-size:1.6rem;box-shadow:0 0 18px rgba(0,229,255,.35)}' +
'#fbDlg .fb-done h3{margin:0;font-family:var(--fdisp);font-size:.95rem;letter-spacing:3px;color:var(--fw)}' +
'#fbDlg .fb-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}' +
'#fbDlg .fb-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 16px;border-radius:8px;border:1px solid var(--fb);background:var(--fpanel);color:var(--fw);font-family:var(--fdisp);font-size:.64rem;font-weight:700;letter-spacing:1.5px;cursor:pointer}' +
'#fbDlg .fb-btn:hover{border-color:var(--fc)}' +
'#fbDlg .fb-say{display:flex;flex-direction:column;gap:10px}' +
'#fbDlg .fb-q{border-left:2px solid var(--fc);padding:8px 12px;background:var(--fpanel);border-radius:0 6px 6px 0}' +
'#fbDlg .fb-q p{margin:0 0 6px;font-size:.98rem;color:var(--ft)}' +
'#fbDlg .fb-q cite{display:block;line-height:1.5;font-family:var(--fmono);font-size:.62rem;letter-spacing:1px;color:var(--fdim);font-style:normal}' +
'#fbDlg .fb-q .st{color:var(--fgold);letter-spacing:2px}' +
'#fbDlg .fb-empty{text-align:center;color:var(--fdim);font-size:.92rem;padding:16px 6px;margin:0}' +
'#fbDlg .fb-say .fb-btn{align-self:center}' +
'html.fb-open #nms-top-btn,html.fb-open .to-top,html.fb-open #nmsTourPill,html.fb-open #nmsCalmBtn{visibility:hidden}' +
'@media (prefers-reduced-motion:reduce){#fbDlg .fb-chips span,#fbDlg .fb-sw input,#fbDlg .fb-sw input::after{transition:none}}';

  var TYPE = {
    review: { tools: 'WHICH TOOLS HAVE YOU USED?', text: 'WHAT DO YOU LIKE, OR WHAT COULD BE BETTER?', ph: 'Tell us anything: a favourite feature, something to improve…' },
    bug: { tools: 'WHICH TOOL?', text: 'WHAT WENT WRONG?', ph: 'What did you tap, and what happened?' },
    idea: { tools: 'WHICH TOOL?', text: 'WHAT WOULD YOU LIKE ADDED OR CHANGED?', ph: 'Describe your idea…' }
  };
  function ico(n) { return '<img class="fb-ico" src="' + BASE + 'fb-ico-' + n + '.webp" srcset="' + BASE + 'fb-ico-' + n + '@2x.webp 2x" alt="" width="24" height="24">'; }

  var d, f, t, send, done, say, err, tabs, rating = 0, sent = false, lastFocus = null, reviews = null;
  function $(id) { return document.getElementById(id); }

  function build() {
    if (d) return;
    var st = document.createElement('style'); st.id = 'fbCss'; st.textContent = CSS; document.head.appendChild(st);
    d = el('div'); d.id = 'fbDlg'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'fbTitle');
    /* data-t = English text (translated by words()), data-tp = placeholder, data-ta = aria-label */
    d.innerHTML =
      '<div id="fbBox">' +
        '<div class="fb-head"><span class="fb-kick" id="fbTitle" data-t="◆ REVIEWS &amp; FEEDBACK"></span><button type="button" id="fbClose" data-ta="Close">✕</button></div>' +
        '<div class="fb-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-v="send" data-t="SEND FEEDBACK"></button><button type="button" role="tab" aria-selected="false" data-v="say" data-t="WHAT TRAVELLERS SAY"></button></div>' +
        '<form class="fb-form" id="fbForm" novalidate>' +
          '<div><p class="fb-lbl" data-t="WHAT\'S IT ABOUT, TRAVELLER?"></p><div class="fb-chips fb-type" role="radiogroup">' +
            '<label><input type="radio" name="fbType" value="review" checked><span>' + ico('review') + '<b style="font-weight:inherit" data-t="Review"></b></span></label>' +
            '<label><input type="radio" name="fbType" value="bug"><span>' + ico('bug') + '<b style="font-weight:inherit" data-t="Bug"></b></span></label>' +
            '<label><input type="radio" name="fbType" value="idea"><span>' + ico('idea') + '<b style="font-weight:inherit" data-t="Idea / request"></b></span></label></div></div>' +
          '<div><p class="fb-lbl"><span id="fbToolsLbl"></span> <small data-t="(TAP ALL THAT APPLY)"></small></p><div class="fb-chips" id="fbTools" translate="no"></div></div>' +
          '<div id="fbRateWrap"><p class="fb-lbl"><span data-t="RATING"></span> <small data-t="(OPTIONAL)"></small></p><div class="fb-stars" id="fbStars" role="radiogroup" data-ta="Rating"></div></div>' +
          '<div><p class="fb-lbl" id="fbTextLbl"></p>' +
            '<textarea class="fb-ta" id="fbText" maxlength="1000" aria-labelledby="fbTextLbl"></textarea>' +
            '<div class="fb-count"><span id="fbCount">0</span>/1000</div></div>' +
          '<div><p class="fb-lbl" id="fbNameLbl"><span data-t="YOUR NAME"></span> <small data-t="(OPTIONAL)"></small></p><input class="fb-in" id="fbName" maxlength="40" autocomplete="nickname" data-tp="Traveller, Reddit or Discord name" aria-labelledby="fbNameLbl"></div>' +
          '<label class="fb-sw" id="fbShowWrap"><input type="checkbox" id="fbShow"><span data-t="OK to show this on the site (with my name, if given)"></span></label>' +
          '<input class="fb-hp" name="website" id="fbHp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<p class="fb-note" id="fbDevNote" hidden data-t="Your device type and browser are added so it can be fixed faster. Nothing personal."></p>' +
          '<p class="fb-note" data-t="elegra1965 reads every message. Nothing goes on the site without his OK."></p>' +
          '<p class="fb-err" id="fbErr" role="alert" hidden></p>' +
          '<button type="submit" class="fb-send" id="fbSend" disabled data-t="SEND"></button>' +
        '</form>' +
        '<div class="fb-done" id="fbDone" hidden><div class="tick" aria-hidden="true">✓</div><h3 data-t="TRANSMISSION RECEIVED"></h3>' +
          '<p class="fb-note" data-t="Thanks, traveller. Your feedback has been sent."></p>' +
          '<div class="fb-row"><button type="button" class="fb-btn" id="fbAgain" data-t="SEND ANOTHER"></button><button type="button" class="fb-btn" id="fbDoneClose" data-t="CLOSE"></button></div></div>' +
        '<div class="fb-say" id="fbSay" hidden></div>' +
      '</div>';
    document.body.appendChild(d);
    f = $('fbForm'); t = $('fbText'); send = $('fbSend'); done = $('fbDone'); say = $('fbSay'); err = $('fbErr');
    tabs = d.querySelectorAll('.fb-tabs button');

    TOOLS.forEach(function (x) {
      var l = el('label'), i = el('input'), s = el('span', null, x[1]);
      i.type = 'checkbox'; i.name = 'fbTool'; i.value = x[0]; i.checked = x[0] === SITE;
      l.appendChild(i); l.appendChild(s); $('fbTools').appendChild(l);
    });
    for (var k = 1; k <= 5; k++) {
      var sb = el('button', null, '★'); sb.type = 'button'; sb.dataset.s = k; sb.setAttribute('aria-pressed', 'false');
      $('fbStars').appendChild(sb);
    }

    f.addEventListener('change', function (e) { if (e.target.name === 'fbType') applyType(); });
    t.addEventListener('input', function () { $('fbCount').textContent = t.value.length; check(); err.hidden = true; });
    $('fbStars').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      rating = +b.dataset.s === rating ? 0 : +b.dataset.s;
      $('fbStars').querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', +x.dataset.s <= rating); x.setAttribute('aria-pressed', String(+x.dataset.s === rating)); });
    });
    tabs.forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.v); }); });
    $('fbClose').addEventListener('click', function () { close(); });
    $('fbDoneClose').addEventListener('click', function () { close(); });
    $('fbAgain').addEventListener('click', function () { reset(); showTab('send'); t.focus(); });
    d.addEventListener('click', function (e) { if (e.target === d) close(); });
    f.addEventListener('submit', submit);
    words();
  }

  /* the opener buttons on the page: <span data-fbt="REVIEWS & FEEDBACK"> inside [data-nms-feedback] */
  var BTN_CSS = '.nms-fb-btn{border-color:rgba(0,229,255,.55)!important;color:#00e5ff!important}.nms-fb-ico{width:20px;height:20px;object-fit:contain;vertical-align:middle;margin:-4px 6px -4px 0;flex:none}';
  function labels() {
    if (!document.getElementById('fbBtnCss') && document.head) { var c = document.createElement('style'); c.id = 'fbBtnCss'; c.textContent = BTN_CSS; document.head.appendChild(c); }
    document.querySelectorAll('[data-nms-feedback] [data-fbt]').forEach(function (x) { x.textContent = T(x.getAttribute('data-fbt')); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', labels); else labels();
  document.addEventListener('nms-lang', labels);

  function words() {
    if (!d) return;
    d.querySelectorAll('[data-t]').forEach(function (x) { x.textContent = T(x.getAttribute('data-t')); });
    d.querySelectorAll('[data-tp]').forEach(function (x) { x.placeholder = T(x.getAttribute('data-tp')); });
    d.querySelectorAll('[data-ta]').forEach(function (x) { x.setAttribute('aria-label', T(x.getAttribute('data-ta'))); });
    $('fbStars').querySelectorAll('button').forEach(function (x) { var n = +x.dataset.s; x.setAttribute('aria-label', n === 1 ? T('1 star') : T('{n} stars', { n: n })); });
    applyType();
    if (!say.hidden) renderSay();
  }
  document.addEventListener('nms-lang', words);

  function type() { var c = f.querySelector('input[name=fbType]:checked'); return c ? c.value : 'review'; }
  function applyType() {
    var ty = type(), c = TYPE[ty];
    $('fbToolsLbl').textContent = T(c.tools);
    $('fbTextLbl').textContent = T(c.text);
    t.placeholder = T(c.ph);
    $('fbRateWrap').hidden = ty !== 'review';
    $('fbShowWrap').hidden = ty !== 'review';
    $('fbDevNote').hidden = ty !== 'bug';
  }
  function check() { send.disabled = t.value.trim().length < 3; }

  function showTab(which) {
    tabs.forEach(function (x) { x.setAttribute('aria-selected', String(x.dataset.v === which)); });
    var s = which === 'say';
    say.hidden = !s; f.hidden = s || sent; done.hidden = s || !sent;
    if (s) renderSay();
  }

  function getReviews() {
    if (!reviews) reviews = fetch(API + '?reviews=1').then(function (r) { return r.ok ? r.json() : { reviews: [] }; })
      .then(function (j) { return (j && j.reviews) || []; }).catch(function () { reviews = null; return []; });
    return reviews;
  }
  function renderSay() {
    say.textContent = ''; say.appendChild(el('p', 'fb-empty', T('Loading…')));
    getReviews().then(function (list) {
      say.textContent = '';
      if (!list.length) say.appendChild(el('p', 'fb-empty', T('No reviews yet. Be the first: pick Review, write a few words and switch on “OK to show”.')));
      var loc = lang();
      list.forEach(function (r) {
        var q = el('div', 'fb-q'), p = el('p');
        if (r.s) { p.appendChild(el('span', 'st', '★'.repeat(r.s))); p.appendChild(document.createTextNode(' ')); }
        var txt = el('span', null, r.q); txt.setAttribute('translate', 'no'); p.appendChild(txt);
        var c = el('cite'); c.setAttribute('translate', 'no');
        var bits = [r.w || T('A traveller')];
        if (r.tools && r.tools.length) bits.push(r.tools.map(function (x) { return TNAME[x] || x; }).join(', '));
        try { bits.push(new Date(r.d).toLocaleDateString(loc, { month: 'short', year: 'numeric' })); } catch (e) {}
        c.textContent = bits.join(' · ').toUpperCase();
        q.appendChild(p); q.appendChild(c); say.appendChild(q);
      });
      var w = el('button', 'fb-btn', T('✎ WRITE YOUR OWN')); w.type = 'button';
      w.addEventListener('click', function () { if (sent) reset(); showTab('send'); });
      say.appendChild(w);
    });
  }

  function open(tab) {
    build();
    if (!d.classList.contains('show')) {
      lastFocus = document.activeElement;
      words();
      $('fbBox').scrollTop = 0;
      d.classList.add('show'); document.documentElement.classList.add('fb-open');
      document.documentElement.style.overflow = 'hidden';
      try { history.pushState({ fb: 1 }, ''); } catch (e) {}
      setTimeout(function () { $('fbClose').focus(); }, 30);
    }
    showTab(tab || 'send');
  }
  function close(fromBack) {
    if (!d || !d.classList.contains('show')) return;
    d.classList.remove('show'); document.documentElement.classList.remove('fb-open');
    document.documentElement.style.overflow = '';
    if (!fromBack && history.state && history.state.fb) history.back();
    if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }
  function reset() {
    sent = false; f.reset(); rating = 0; t.value = '';
    f.querySelectorAll('input[name=fbTool]').forEach(function (i) { i.checked = i.value === SITE; });
    $('fbCount').textContent = '0'; err.hidden = true;
    $('fbStars').querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-pressed', 'false'); });
    applyType(); check();
  }
  window.NMSFeedback = { open: function () { open('send'); }, openReviews: function () { open('say'); }, close: function () { close(); } };

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-nms-feedback]');
    if (!b) return;
    e.preventDefault();
    open(b.getAttribute('data-nms-feedback') === 'reviews' ? 'say' : 'send');
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && d && d.classList.contains('show')) { e.stopPropagation(); close(); } }, true);
  window.addEventListener('popstate', function () { close(true); });

  function browser() {
    var u = navigator.userAgent, b = 'Browser', o = '', m;
    if ((m = u.match(/SamsungBrowser\/(\d+)/))) b = 'Samsung ' + m[1];
    else if ((m = u.match(/Edg\/(\d+)/))) b = 'Edge ' + m[1];
    else if ((m = u.match(/OPR\/(\d+)/))) b = 'Opera ' + m[1];
    else if ((m = u.match(/Firefox\/(\d+)/))) b = 'Firefox ' + m[1];
    else if ((m = u.match(/CriOS\/(\d+)/)) || (m = u.match(/Chrome\/(\d+)/))) b = 'Chrome ' + m[1];
    else if ((m = u.match(/Version\/(\d+).*Safari/))) b = 'Safari ' + m[1];
    if (/Android/.test(u)) o = 'Android'; else if (/iPhone|iPad|iPod/.test(u)) o = 'iOS'; else if (/Windows/.test(u)) o = 'Windows';
    else if (/Mac OS X/.test(u)) o = 'Mac'; else if (/CrOS/.test(u)) o = 'ChromeOS'; else if (/Linux/.test(u)) o = 'Linux';
    return b + (o ? ' / ' + o : '');
  }
  function siteVersion() {
    if (!window.caches) return Promise.resolve('');
    return caches.keys().then(function (ks) { return ks.filter(function (k) { return CACHE_RE.test(k); })[0] || ''; }).catch(function () { return ''; });
  }

  function submit(e) {
    e.preventDefault();
    if (send.disabled) return;
    var ty = type();
    send.disabled = true; send.textContent = T('SENDING…'); err.hidden = true;
    siteVersion().then(function (ver) {
      var body = {
        type: ty,
        tools: [].map.call(f.querySelectorAll('input[name=fbTool]:checked'), function (x) { return x.value; }),
        rating: ty === 'review' ? rating : 0,
        text: t.value.trim(),
        name: $('fbName').value.trim(),
        show: ty === 'review' && $('fbShow').checked,
        website: $('fbHp').value,
        info: {
          site: SITE, app: ver, lang: lang(),
          screen: ty === 'bug' ? (innerWidth + 'x' + innerHeight) : '',
          installed: ty === 'bug' && !!(window.matchMedia && matchMedia('(display-mode: standalone)').matches || navigator.standalone),
          browser: ty === 'bug' ? browser() : ''
        }
      };
      return fetch(API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }).then(function (r) {
      if (r.status === 429) throw 'slow';
      if (!r.ok) throw 'fail';
      sent = true; showTab('send');
      try { if (window.goatcounter && goatcounter.count) goatcounter.count({ path: 'feedback/' + ty, event: true }); } catch (x) {}
    }).catch(function (x) {
      err.textContent = T(x === 'slow' ? 'Too many sends. Try again in an hour.' : 'Couldn\'t send. Check your connection and try again.');
      err.hidden = false;
    }).then(function () { send.textContent = T('SEND'); check(); });
  }
})();
