const SalesRecord = require('../models/sale');

exports.listSalesRecords = async (req, res) => {
    const {page = 1, limit = 10, sort = 'orderDate', search, ...filters} = req.query;
    const userId = req.user._id;

    try {
        const query = {user: userId};

        const allowedFilters = ["region", "country", "itemType", "salesChannel", "orderPriority"];
        for(const key in filters){
            if (allowedFilters.includes(key) && filters[key]){
                query[key] = new RegExp(filters[key], 'i'); 
            }
        }

        // Global search across multiple fields
        if(search){
            query.$or = [
                {region: new RegExp(search, 'i')},
                {country: new RegExp(search, 'i')},
                {itemType: new RegExp(search, 'i')},
                {salesChannel: new RegExp(search, 'i')},
                {orderPriority: new RegExp(search, 'i')},
                {orderId: new RegExp(search, 'i')}
            ];
        }

        const numericLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const numericPage = Math.max(parseInt(page, 10) || 1, 1);

        const records = await SalesRecord.find(query)
            .sort({ [sort]: 1 })
            .limit(numericLimit)
            .skip((numericPage - 1) * numericLimit)
            .exec();

        const count = await SalesRecord.countDocuments(query);

        if(records.length === 0){
            return res.status(404).json({
                message: "No sales records found for the given search/filter.",
                records: [],
                totalPages: 0,
                currentPage: numericPage,
                totalRecords: 0
            });
        }

        res.json({
            records,
            totalPages: Math.ceil(count / numericLimit),
            currentPage: numericPage,
            totalRecords: count
        });
    } 
    catch(error){
        console.error('List sales error:', error.message);
        res.status(500).json({error: 'Failed to fetch sales records.'});
    }
};

exports.addSalesRecord = async (req, res) => {
    try{
        const record = new SalesRecord({...req.body, user: req.user._id});
        await record.save();
        res.status(201).json(record);
    } 
    catch(error){
        console.error('Add sale error:', error.message);
        res.status(500).json({error: 'Failed to add sales record.'});
    }
};

exports.updateSalesRecord = async (req, res) => {
    try{
        const record = await SalesRecord.findOneAndUpdate(
            {_id: req.params.id, user: req.user._id},
            req.body, {new: true}
        );

        if(!record){
            return res.status(404).json({error: 'Record not found.'});
        }
        res.json(record);
    }
    catch(error){
        console.error('Update sale error:', error.message);
        res.status(500).json({error: 'Failed to update sales record.'});
    }
};

exports.deleteSalesRecord = async (req, res) => {
    try{
        const record = await SalesRecord.findOneAndDelete({_id: req.params.id, user: req.user._id});

        if(!record){
            return res.status(404).json({error: 'Record not found.'});
        }

        res.json({message: 'Record deleted successfully.'});
    } 
    catch(error){
        console.error('Delete sale error:', error.message);
        res.status(500).json({error: 'Failed to delete sales record.'});
    }
};
