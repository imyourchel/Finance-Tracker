const Category = require("../models/Category");

// GET semua kategori
const getCategories = async (req, res) => {
    try {
        const { type } = req.query;

        const filter = {
            $or: [{ user: req.user._id }, { user: null }],
            isActive: true,
        };

        // Sekarang tidak ada type 'both', jadi filter langsung
        if (type) filter.type = type;

        const categories = await Category.find(filter).sort({
            order: 1,
            name: 1,
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST buat kategori custom
const createCategory = async (req, res) => {
    try {
        const { name, type, icon, color } = req.body;

        const exists = await Category.findOne({
            user: req.user._id,
            name,
            type,
        });
        if (exists)
            return res.status(400).json({ message: "Kategori sudah ada" });

        const category = await Category.create({
            user: req.user._id,
            name,
            type,
            icon: icon || "tag",
            color: color || "#4f46e5",
            isDefault: false,
        });

        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE nonaktifkan kategori
const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!category)
            return res
                .status(404)
                .json({ message: "Kategori tidak ditemukan" });

        if (category.isDefault)
            return res
                .status(400)
                .json({ message: "Kategori default tidak bisa dihapus" });

        category.isActive = false;
        await category.save();

        res.json({ message: "Kategori dihapus" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { getCategories, createCategory, deleteCategory };
