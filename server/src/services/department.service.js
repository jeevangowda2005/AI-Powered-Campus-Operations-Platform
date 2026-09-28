const prisma = require('../config/db');

const DEFAULT_DEPARTMENTS = [
  'IT Services',
  'Electrical',
  'Plumbing',
  'Facilities & Cleaning',
  'Campus Security',
  'Transport',
];

/**
 * Seed default departments if they do not exist
 */
const seedDefaultDepartments = async () => {
  for (const deptName of DEFAULT_DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: deptName },
      update: {},
      create: { name: deptName },
    });
  }
};

/**
 * Get all campus departments
 */
const getAllDepartments = async () => {
  // Ensure default departments are seeded
  await seedDefaultDepartments();
  return prisma.department.findMany({
    orderBy: { name: 'asc' },
  });
};

module.exports = {
  seedDefaultDepartments,
  getAllDepartments,
};
