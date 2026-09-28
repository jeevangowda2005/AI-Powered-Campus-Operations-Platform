const bcrypt = require('bcryptjs');
const prisma = require('../config/db');
const { generateToken } = require('../utils/jwt.util');

/**
 * Remove sensitive passwordHash from user object
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

/**
 * Register a new user
 */
const registerUser = async ({ name, email, password, role }) => {
  if (!name || !email || !password) {
    const error = new Error('Name, email, and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Check duplicate email
  const existingUser = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (existingUser) {
    const error = new Error('Email is already registered');
    error.statusCode = 400;
    throw error;
  }

  // Validate Role if passed
  const validRoles = ['STUDENT', 'STAFF', 'ADMIN'];
  const userRole = role && validRoles.includes(role.toUpperCase()) ? role.toUpperCase() : 'STUDENT';

  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Create user
  const newUser = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: userRole,
    },
  });

  const safeUser = sanitizeUser(newUser);

  // Generate JWT token
  const token = generateToken({
    id: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  });

  return { user: safeUser, token };
};

/**
 * Login user
 */
const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Email and password are required');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Find user by email (case-insensitive)
  const user = await prisma.user.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (!user) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  // Compare password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }

  const safeUser = sanitizeUser(user);

  // Generate JWT token
  const token = generateToken({
    id: safeUser.id,
    email: safeUser.email,
    role: safeUser.role,
  });

  return { user: safeUser, token };
};

/**
 * Get user by ID (omits passwordHash)
 */
const getUserById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    const error = new Error('User not found');
    error.statusCode = 404;
    throw error;
  }

  return sanitizeUser(user);
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
};
