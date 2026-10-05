# Activarea Google Classroom în Orar

Interfața este pregătită, dar autentificarea nu funcționează până când este configurat un client OAuth Google real. GitHub Pages poate găzdui acest client web; nu este necesar un backend pentru accesul temporar, numai în citire.

1. În Google Cloud Console, creează/selectează proiectul și activează **Google Classroom API**.
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

Toate listele sunt paginate până la capăt. Materialele se deschid în Google Drive, Docs, YouTube sau adresa publicată, într-un tab separat; accesul la fișiere rămâne supus permisiunilor contului Google. Nu se pot ocoli aceste permisiuni. O clasă fără permisiuni sau o secțiune inaccesibilă afișează un mesaj, nu materiale inventate.

Tokenul rămâne doar în memoria tabului. Datele Classroom și profilul nu se scriu în localStorage sau în cache-ul service worker-ului. La reîncărcare/expirare poate fi necesară reconectarea. Deconectarea golește interfața și revocă tokenul. Temele locale din Materii sunt separate.

## Validare

Înainte de configurarea Client ID, sunt testabile doar starea neconfigurată și fluxurile cu răspunsuri API simulate. După activare, testează autentificarea pe iPhone, lista claselor, deschiderea materialelor, expirarea și deconectarea cu un cont real.

Documentație: https://developers.google.com/workspace/classroom/quickstart/js și https://developers.google.com/identity/oauth2/web/guides/use-token-model
