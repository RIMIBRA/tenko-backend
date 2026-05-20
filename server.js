const express = require('express');
const cors = require('cors');
require('dotenv').config();
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ── TEST ──
app.get('/', (req, res) => {
  res.json({ message: '✅ Serveur Tenko Lodge opérationnel !' });
});

// ── AUTHENTIFICATION DASHBOARD ──
app.post('/api/auth', (req, res) => {
  const { email, password } = req.body;
  const adminEmail    = process.env.ADMIN_EMAIL    || 'gerant@tenkolodge.bf';
  const adminPassword = process.env.ADMIN_PASSWORD || 'tenko2025';
  if (email === adminEmail && password === adminPassword) {
    res.json({ succes: true });
  } else {
    res.status(401).json({ erreur: 'Identifiants incorrects' });
  }
});

// ── RESERVATIONS ──

// Créer une réservation
app.post('/api/reservations', (req, res) => {
  const { client_nom, client_telephone, client_email,
          type_chambre, date_arrivee, date_depart,
          nb_personnes, montant_total, notes } = req.body;

  // Validation des champs requis
  if (!client_nom || !client_telephone || !type_chambre || !date_arrivee || !date_depart || !montant_total) {
    return res.status(400).json({ erreur: 'Champs obligatoires manquants (nom, téléphone, chambre, dates, montant).' });
  }

  const typesValides = ['confort', 'superieure', 'suite'];
  if (!typesValides.includes(type_chambre)) {
    return res.status(400).json({ erreur: 'Type de chambre invalide.' });
  }

  if (new Date(date_depart) <= new Date(date_arrivee)) {
    return res.status(400).json({ erreur: 'La date de départ doit être après la date d\'arrivée.' });
  }

  const reference = 'TENKO-' + Math.floor(1000 + Math.random() * 9000);

  const sql = `INSERT INTO reservations
    (reference, client_nom, client_telephone, client_email,
     type_chambre, date_arrivee, date_depart,
     nb_personnes, montant_total, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [reference, client_nom, client_telephone,
    client_email, type_chambre, date_arrivee, date_depart,
    nb_personnes || 1, montant_total, notes || ''], (err, result) => {
    if (err) {
      console.error('❌ Erreur réservation:', err);
      return res.status(500).json({ erreur: 'Erreur serveur' });
    }
    res.json({
      succes: true,
      reference: reference,
      message: 'Réservation enregistrée !'
    });
  });
});

// Récupérer toutes les réservations
app.get('/api/reservations', (req, res) => {
  const sql = `SELECT * FROM reservations ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
    res.json(results);
  });
});

// Changer le statut d'une réservation
app.put('/api/reservations/:id/statut', (req, res) => {
  const { statut } = req.body;
  const statutsValides = ['nouvelle', 'confirmee', 'annulee'];
  if (!statutsValides.includes(statut)) {
    return res.status(400).json({ erreur: 'Statut invalide.' });
  }
  const sql = `UPDATE reservations SET statut = ? WHERE id = ?`;
  db.query(sql, [statut, req.params.id], (err) => {
    if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
    res.json({ succes: true });
  });
});

// ── STATISTIQUES ──
// Les stats excluent les réservations annulées pour les revenus
app.get('/api/stats', (req, res) => {
  const stats = {};

  db.query(
    `SELECT COUNT(*) as total, SUM(montant_total) as revenus
     FROM reservations
     WHERE DATE(created_at) = CURDATE() AND statut != 'annulee'`,
    (err, result) => {
      if (err) return res.status(500).json({ erreur: 'Erreur serveur' });
      stats.aujourd_hui = result[0];

      db.query(
        `SELECT COUNT(*) as total, SUM(montant_total) as revenus
         FROM reservations
         WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE()) AND statut != 'annulee'`,
        (err2, result2) => {
          if (err2) return res.status(500).json({ erreur: 'Erreur serveur' });
          stats.ce_mois = result2[0];

          db.query(
            `SELECT type_chambre, COUNT(*) as total
             FROM reservations
             WHERE statut != 'annulee'
             GROUP BY type_chambre`,
            (err3, result3) => {
              if (err3) return res.status(500).json({ erreur: 'Erreur serveur' });
              stats.par_chambre = result3;
              res.json(stats);
            }
          );
        }
      );
    }
  );
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur Tenko Lodge démarré sur http://localhost:${PORT}`);
});