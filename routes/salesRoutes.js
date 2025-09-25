const express = require('express');
const router = express.Router();

const salesController = require('../controllers/salesController');
const {authenticate} = require('../middleware/auth'); 

// Apply authentication middleware to all sales routes
router.use(authenticate);

// List sales records
router.get('/', salesController.listSalesRecords);

// Add a sales record
router.post('/', salesController.addSalesRecord);

// Update a sales record
router.put('/:id', salesController.updateSalesRecord);

// Delete a sales record
router.delete('/:id', salesController.deleteSalesRecord);

module.exports = router;
