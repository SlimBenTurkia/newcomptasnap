# ComptaSnap

Chaque dépense laisse une trace. App de suivi des dépenses, factures et reçus : scan de reçus par IA (Gemini/Groq), dictée vocale, factures clients, archivage Google Drive, bot Telegram, clôture mensuelle.

Le nouveau design (maquettes dans `design/`) remplace l'ancien : charte encre / papier / lime, polices Bricolage Grotesque + JetBrains Mono, navigation basse Accueil · Factures · Scanner · Reçus · Bilan, connexion e-mail + Google.

## Démarrer

```bash
bun install        # ou npm install
cp .env.example .env   # renseigner les clés (voir ci-dessous)
npm run dev        # serveur Express + Vite
npm run build && npm start
```

## Firebase : à activer pour la connexion par e-mail

Console Firebase → Authentication → Méthode de connexion → activer **E-mail/Mot de passe** (Google reste actif). Sans cela, le bouton « Se connecter » par e-mail affichera un message d'erreur explicite ; la connexion Google fonctionne comme avant.

## Variables d'environnement

Voir `.env.example` (GROQ_API_KEY, GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, Firebase Admin, VITE_API_URL…).

## Design

- `design/index.html` : les 6 maquettes côte à côte
- `design/README.md` : palette et typographies
