# Activarea Google Classroom în Orar

Interfața este pregătită, dar autentificarea nu funcționează până când este configurat un client OAuth Google real. GitHub Pages poate găzdui acest client web; nu este necesar un backend pentru accesul temporar, numai în citire.

1. În Google Cloud Console, creează/selectează proiectul și activează **Google Classroom API** și **Google Drive API**. Drive API este folosit doar pentru viewerul local al fișierelor PDF/XLS/XLSX atașate în Classroom.
2. În **Google Auth Platform**, configurează **Branding**, **Audience** și **Data Access**. În modul Testing, adaugă contul care va folosi site-ul la **Test users**. Pentru distribuție publică, respectă cerințele de verificare OAuth afișate de Google; conturile instituționale pot necesita aprobarea administratorului.
3. Creează un OAuth client de tip **Web application**.
4. La **Authorized JavaScript origins**, adaugă exact `https://exinity25.github.io` (fără `/Orar/`). Modelul popup folosit aici nu necesită un backend sau un client secret.
5. Copiază **Client ID**, terminat în `.apps.googleusercontent.com`, în `classroom-config.js`. ID-ul este public. Nu publica client secret, parolă sau token.
6. Deschide site-ul, meniul → Classroom → Conectează contul Google. Alege contul și aprobă accesul cerut.

## Acces solicitat

- `openid email profile` pentru identitatea, poza și e-mailul contului conectat.
- `classroom.courses.readonly` pentru clase.
- `classroom.courseworkmaterials.readonly` pentru materialele publicate.
- `classroom.coursework.me.readonly` pentru activitățile/temele vizibile elevului, inclusiv atașamentele lor. Nu se citesc separat notele/submissions și nu se scrie nimic.
- `classroom.announcements.readonly` pentru anunțuri și atașamente.
- `drive.readonly` pentru a descărca în browser, numai în citire, fișierele Drive pe care contul le poate accesa. Este necesar pentru afișarea PDF/XLS/XLSX direct în site.

Toate listele sunt paginate până la capăt. PDF-urile și fișierele XLS/XLSX sunt descărcate temporar în browser prin Google Drive API și afișate local în viewerul site-ului; celelalte tipuri de materiale folosesc linkul publicat. Accesul la fișiere rămâne supus permisiunilor contului Google. Nu se pot ocoli aceste permisiuni. O clasă fără permisiuni sau o secțiune inaccesibilă afișează un mesaj, nu materiale inventate.

Tokenul de acces este păstrat local împreună cu momentul expirării, ca redeschiderea PWA-ului să nu provoace o nouă fereastră Google cât timp tokenul este încă valid. Tokenul nu este pus în cache-ul service worker-ului și este șters la deconectare sau după expirare. Aplicația memorează local datele minime ale contului (nume, e-mail și URL-ul pozei). Deoarece Google nu oferă refresh token persistent fluxului JavaScript client-side, după expirarea access token-ului este necesară o nouă cerere de acces; aplicația nu mai pornește automat acea fereastră, ci afișează butonul de continuare. Deconectarea șterge tokenul și contul memorat și revocă tokenul curent. Temele locale din Materii sunt separate.

## Validare

Înainte de configurarea Client ID, sunt testabile doar starea neconfigurată și fluxurile cu răspunsuri API simulate. După activare, testează autentificarea pe iPhone, lista claselor, deschiderea materialelor, expirarea și deconectarea cu un cont real.

Documentație: https://developers.google.com/workspace/classroom/quickstart/js și https://developers.google.com/identity/oauth2/web/guides/use-token-model
