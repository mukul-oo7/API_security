const { Router } = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = mongoose.model('users');

const router = new Router();


// Sign-up route
router.post('/signup', async (req, res) => {
  try {
    const { userName, firstName, lastName, password } = req.body;

    // Check if user already exists
    let user = await User.findOne({ userName });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    user = new User({
      userName,
      firstName,
      lastName,
      password: hashedPassword,
    });

    await user.save();

    res.status(201).json({ message: 'User created successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { userName, password } = req.body;

    if(!userName || !password){
      return res.status(400).send({message: 'please provide your userName and password'});
    }

    // Check if user exists
    let user = await User.findOne({ userName });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create and send token
    const payload = {
      user: {
        id: user.id,
      },
    };

    jwt.sign(
      payload,
      'flipkartGrid',
      { expiresIn: '1h' },
      (err, token) => {
        if (err) throw err;
        res.json({ token });
      }
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;