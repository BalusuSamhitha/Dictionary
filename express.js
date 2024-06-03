const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const session = require('express-session');
const admin = require('firebase-admin');
const util = require('util');
const bcrypt = require('bcrypt');

const serviceAccount = require('./key.json');

const app = express();
const port = process.env.PORT || 3000;


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


app.use(session({
  secret: 'your_secret_key', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


const quizQuestions = [
  { question: 'What is the synonym of "happy"?', options: ['Sad', 'Elated', 'Angry', 'Confused'], answer: 'Elated' },
  { question: 'What is the antonym of "fast"?', options: ['Quick', 'Slow', 'Rapid', 'Swift'], answer: 'Slow' },
  { question: 'What is the synonym of "big"?', options: ['Tiny', 'Large', 'Small', 'Little'], answer: 'Large' },
  { question: 'What is the antonym of "bright"?', options: ['Dull', 'Shiny', 'Clear', 'Radiant'], answer: 'Dull' },
  { question: 'What is the synonym of "smart"?', options: ['Dumb', 'Intelligent', 'Ignorant', 'Stupid'], answer: 'Intelligent' },
  { question: 'What is the antonym of "hard"?', options: ['Soft', 'Rough', 'Tough', 'Firm'], answer: 'Soft' },
  { question: 'What is the synonym of "strong"?', options: ['Weak', 'Feeble', 'Powerful', 'Fragile'], answer: 'Powerful' },
  { question: 'What is the antonym of "hot"?', options: ['Warm', 'Cold', 'Lukewarm', 'Boiling'], answer: 'Cold' },
  { question: 'What is the synonym of "quick"?', options: ['Slow', 'Rapid', 'Sluggish', 'Idle'], answer: 'Rapid' },
  { question: 'What is the antonym of "light"?', options: ['Heavy', 'Bright', 'Luminous', 'Radiant'], answer: 'Heavy' },
  { question: 'What is the synonym of "fear"?', options: ['Bravery', 'Courage', 'Terror', 'Peace'], answer: 'Terror' },
  { question: 'What is the antonym of "love"?', options: ['Hate', 'Affection', 'Fondness', 'Adoration'], answer: 'Hate' },
  { question: 'What is the synonym of "joy"?', options: ['Misery', 'Sorrow', 'Happiness', 'Grief'], answer: 'Happiness' },
  { question: 'What is the antonym of "strong"?', options: ['Weak', 'Powerful', 'Resilient', 'Hard'], answer: 'Weak' },
  { question: 'What is the synonym of "brave"?', options: ['Cowardly', 'Fearless', 'Timid', 'Afraid'], answer: 'Fearless' },
  
];


const delay = util.promisify(setTimeout);


function isAuthenticated(req, res, next) {
  if (req.session.user) {
    return next();
  } else {
    res.redirect('/login');
  }
}


app.get('/', (req, res) => {
  res.redirect('/login');
});


app.get('/login', (req, res) => {
  res.render('login');
});


app.get('/signup', (req, res) => {
  res.render('signup');
});


app.get('/search-history', isAuthenticated, async (req, res) => {
  try {
    const email = req.session.user.email;
    const searchHistorySnapshot = await db.collection('searchHistory').where('email', '==', email).get();
    const searchHistory = searchHistorySnapshot.docs.map(doc => doc.data());
    res.render('searchHistory', { searchHistory });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).send('Error fetching search history');
  }
});

app.get('/dashboard', isAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const email = user.email;
    
    
    const searchHistorySnapshot = await db.collection('searchHistory').where('email', '==', email).get();
    const searchHistory = searchHistorySnapshot.docs.map(doc => doc.data());

    res.render('dashboard', { user, searchHistory });
  } catch (error) {
    console.error('Error fetching search history:', error);
    res.status(500).send('Error fetching search history');
  }
});


app.get('/urban-dictionary', isAuthenticated, async (req, res) => {
  const word = req.query.word;
  if (!word) {
    return res.status(400).send('Word query parameter is required');
  }
  try {
    const response = await axios.get(`https://api.urbandictionary.com/v0/define?term=${word}`);
    if (response.data.list.length === 0) {
      return res.status(404).send('No definition found for the word');
    }
    const meaning = response.data.list[0].definition;
    
    
    const email = req.session.user.email;
    await db.collection('searchHistory').add({ email, word, meaning });
    
    res.render('urbanDictionary', { word, meaning }); 
  } catch (error) {
    console.error('Error fetching Urban Dictionary data:', error);
    res.status(500).send('Error fetching data from Urban Dictionary');
  }
});


app.get('/quiz', isAuthenticated, (req, res) => {
  
  const selectedQuestions = shuffle([...quizQuestions]).slice(0, 5);
  req.session.selectedQuestions = selectedQuestions; 
  res.render('quiz', { questions: selectedQuestions });
});

app.post('/quiz', isAuthenticated, (req, res) => {
  const userAnswers = req.body.answers;
  let score = 0;
  const feedback = [];

  const selectedQuestions = req.session.selectedQuestions;

  selectedQuestions.forEach((question, index) => {
    const correctAnswer = question.answer;
    const userAnswer = userAnswers[index];

    if (userAnswer === correctAnswer) {
      score += 10; 
      feedback.push({ question: question.question, userAnswer, correctAnswer, isCorrect: true });
    } else {
      feedback.push({ question: question.question, userAnswer, correctAnswer, isCorrect: false });
    }
  });

  if (req.session.user) {
    req.session.user.rewardPoints = (req.session.user.rewardPoints || 0) + score;
  }

  res.render('quizResult', { score, feedback, totalQuestions: selectedQuestions.length });
});


app.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const existing = await db.collection('users').where('email', '==', email).get();
    if (!existing.empty) {
      return res.status(400).send('User already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.collection('users').add({ username, email, password: hashedPassword });
    res.redirect('/login');
  } catch (error) {
    res.status(500).send('Error occurred: ' + error.message);
  }
});


app.post('/login', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const userSnapshot = await db.collection('users').where('email', '==', email).get();
    if (userSnapshot.empty) {
      return res.status(400).send('User not found');
    }

    const userDoc = userSnapshot.docs[0];
    const user = userDoc.data();
    const match = await bcrypt.compare(password, user.password);
    if (match) {
      
      req.session.user = user;
      res.redirect('/dashboard');
    } else {
      res.status(400).send('Invalid password or user');
    }
  } catch (error) {
    res.status(500).send('Error occurred in login: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

