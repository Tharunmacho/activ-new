import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ImagePlus, Package, IndianRupee, Store } from "lucide-react";
import { toast } from "sonner";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, FieldGrid, Field } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { PRODUCT_CATEGORIES } from "@/lib/productCategories";
import { useActiveCompanyStore } from "@/contexts/ActiveCompanyContext";

const AddProduct = () => {
    const navigate = useNavigate();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { activeCompany, loadCompanies } = useActiveCompanyStore();

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        category: "",
        price: "",
        stock: "",
        sku: "",
        image: null as File | null,
    });

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error('Please upload an image file');
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }

            setFormData({ ...formData, image: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        if (!formData.name || !formData.category || !formData.price) {
            toast.error("Please fill in all required fields");
            return;
        }

        const priceNum = parseFloat(formData.price);
        if (isNaN(priceNum) || priceNum < 0) {
            toast.error("Please enter a valid price");
            return;
        }

        const stockNum = formData.stock ? parseInt(formData.stock) : 0;
        if (isNaN(stockNum) || stockNum < 0) {
            toast.error("Please enter a valid stock quantity");
            return;
        }

        setLoading(true);

        try {
            /**
             * Field names as the API actually reads them.
             *
             * Three of these were wrong and all three failed silently, because
             * an unknown key in a JSON body is simply ignored:
             *   `productName`   -> `name`     (accepted on write, but the
             *                                  response only ever has `name`,
             *                                  so every list showed a blank)
             *   `stockQuantity` -> `stock`    (every product saved with 0)
             *   `productImage`  -> `imageUrl` (the image was dropped)
             *
             * `companyId` is likewise required: without it `createProduct`
             * falls back to "the member's latest company", so a product added
             * while working on an older company landed in the newest catalog.
             *
             * The image goes as a multipart file part named `image`, which is
             * what `product.routes.js` reads (`upload.single('image')`) and what
             * mobile has always sent. This used to pass `imageUrl: imagePreview`
             * — the base64 data URL — in a JSON body. The controller does accept
             * a body `imageUrl`, so it "worked", at the cost of storing a whole
             * image inside the product document instead of on disk under
             * /uploads, where every other image on the platform lives.
             */
            const payload = new FormData();
            if (activeCompany?._id) payload.append('companyId', activeCompany._id);
            payload.append('name', formData.name.trim());
            payload.append('description', formData.description.trim());
            payload.append('category', formData.category);
            payload.append('sku', formData.sku.trim() || `SKU-${Date.now()}`);
            payload.append('price', String(priceNum));
            payload.append('stock', String(stockNum));
            if (formData.image) payload.append('image', formData.image);

            // `apiFetch` drops its own Content-Type for FormData so the browser
            // can set the multipart boundary.
            const response = await apiFetch('/products', { method: 'POST', body: payload });
            const result = await response.json();

            if (result.success) {
                toast.success('Product added successfully!');
                navigate('/business/products');
            } else {
                toast.error(result.message || 'Failed to add product');
            }
        } catch (error) {
            console.error('Error adding product:', error);
            toast.error('An error occurred while adding the product');
        } finally {
            setLoading(false);
        }
    };

    return (
        <BusinessPageShell
            title="Add Product / Service"
            subtitle={activeCompany ? `Adding to ${activeCompany.businessName}` : 'No active company selected'}
            width="standard"
            actions={
                <>
                    <Button
                        variant="outline"
                        className="border-slate-200 text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate("/business/products")}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Cancel</span>
                    </Button>
                    <Button
                        className="bg-blue-600 hover:bg-blue-700"
                        onClick={handleSave}
                        disabled={loading}
                    >
                        {loading ? 'Publishing…' : 'Publish Product'}
                    </Button>
                </>
            }
        >
            {/*
                One column on a phone, three from lg up.

                This was an unconditional `grid grid-cols-3`, with no responsive
                prefix at all — so a 375px screen got a ~110px image dropzone that
                still carried `min-h-[18.75rem]`, beside two columns of fields.
            */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <Card className="lg:sticky lg:top-0">
                    <SectionHeading title="Product Media" icon={ImagePlus} />

                    <label
                        htmlFor="product-image"
                        className="block rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500
                                   transition-colors cursor-pointer overflow-hidden bg-slate-50"
                    >
                        {imagePreview ? (
                            <img src={imagePreview} alt="Product preview" className="w-full h-56 object-cover" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-56 px-4 text-center">
                                <ImagePlus className="h-10 w-10 text-slate-400 mb-3" />
                                <p className="text-sm font-semibold text-slate-700">Upload Product Image</p>
                                <p className="text-xs text-slate-500 mt-1">JPG or PNG, max 5MB</p>
                            </div>
                        )}
                    </label>
                    <input
                        id="product-image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                    />
                    {imagePreview ? (
                        <p className="text-xs text-slate-500 mt-2 text-center">Click the image to change it</p>
                    ) : null}
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <SectionHeading title="Product Details" icon={Package} />
                        <FieldGrid>
                            <Field label="Product Name" required full>
                                <Input
                                    placeholder="Enter product / service name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Description" full>
                                <Textarea
                                    placeholder="Describe your product features & specifications…"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[7.5rem] border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Category" required>
                                {/*
                                    One shared list — `@/lib/productCategories`, mirroring
                                    the backend definition. This screen offered nine
                                    categories of its own (Fashion, Home & Garden, Food &
                                    Beverage…) while Edit Product offered six different
                                    ones and mobile offered fourteen. Only "Electronics"
                                    and "Other" appeared in all three.
                                */}
                                <Select
                                    value={formData.category}
                                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                                >
                                    <SelectTrigger className="h-11 border-slate-200 focus:ring-blue-500">
                                        <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {PRODUCT_CATEGORIES.map((category) => (
                                            <SelectItem key={category} value={category}>{category}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>

                            <Field label="SKU" hint="Left blank, one is generated for you.">
                                <Input
                                    placeholder="e.g. PRD-2024-001"
                                    value={formData.sku}
                                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>
                        </FieldGrid>
                    </Card>

                    <Card>
                        <SectionHeading title="Pricing &amp; Inventory" icon={IndianRupee} />
                        <FieldGrid>
                            <Field label="Price (₹)" required>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Stock Quantity">
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="e.g. 100"
                                    value={formData.stock}
                                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>
                        </FieldGrid>
                    </Card>

                    {!activeCompany && (
                        <Card className="border-amber-200 bg-amber-50">
                            <div className="flex items-start gap-3">
                                <Store className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-sm text-amber-800">
                                    No active company is selected, so this product would be filed
                                    against whichever company the server considers latest. Pick one
                                    from My Companies first.
                                </p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </BusinessPageShell>
    );
};

export default AddProduct;
