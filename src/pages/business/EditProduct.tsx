import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, ImagePlus, Package, IndianRupee } from "lucide-react";
import { toast } from "sonner";
import BusinessPageShell from "./BusinessPageShell";
import { Card, SectionHeading, FieldGrid, Field, Loading } from "./BusinessUI";
import { apiFetch } from "@/services/activApi";
import { resolveMediaUrl } from "@/config/api.config";
import { PRODUCT_CATEGORIES, normalizeProductCategory } from "@/lib/productCategories";

const EditProduct = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    const [formData, setFormData] = useState({
        name: "",
        description: "",
        category: "",
        price: "",
        stock: "",
        sku: "",
        image: null as File | null,
    });

    useEffect(() => {
        if (id) {
            loadProduct();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const loadProduct = async () => {
        try {
            const response = await apiFetch(`/products/${id}`);
            const result = await response.json();

            if (result.success) {
                const product = result.data;
                /**
                 * Read the fields the document actually has.
                 *
                 * `product.stockQuantity` does not exist, so `.toString()` on it
                 * threw and this page rendered blank for every product. `price`
                 * has a schema default so it survived, but it is guarded too --
                 * loading a form must not be able to crash it.
                 */
                setFormData({
                    name: product.name || '',
                    description: product.description || "",
                    /**
                     * A product written before the category lists were reconciled
                     * can hold a value this select no longer offers ("Fashion",
                     * "Toys & Games"). Normalising to '' makes the user pick a
                     * valid one rather than showing a blank select that silently
                     * saves the old value back — or worse, saves empty.
                     */
                    category: normalizeProductCategory(product.category),
                    price: String(product.price ?? 0),
                    stock: String(product.stock ?? 0),
                    sku: product.sku || "",
                    image: null
                });

                if (product.imageUrl) {
                    /**
                     * Re-anchored to the API origin. `imageUrl` is a relative
                     * `/uploads/<file>` path, and this rendered it raw — so the
                     * browser resolved it against the website, which serves no
                     * uploads, and every existing product showed a broken image
                     * in its own edit form.
                     */
                    setImagePreview(resolveMediaUrl(product.imageUrl));
                }
            } else {
                toast.error('Failed to load product');
                navigate('/business/products');
            }
        } catch (error) {
            console.error('Error loading product:', error);
            toast.error('Failed to load product');
            navigate('/business/products');
        } finally {
            setLoadingData(false);
        }
    };

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
             * Same field names as AddProduct; see the note there.
             *
             * The image goes as a multipart `image` part, which is what
             * `product.routes.js` reads. This used to send
             * `imageUrl: imagePreview` in a JSON body — and after picking a new
             * photo `imagePreview` is a base64 data URL, so the whole image was
             * written into the product document rather than to /uploads.
             *
             * When no new file is chosen, `imageUrl` is omitted entirely rather
             * than echoed back: `updateProduct` only touches `product.imageUrl`
             * when the key is present, so leaving it out is what keeps the
             * existing photo.
             */
            const payload = new FormData();
            payload.append('name', formData.name.trim());
            payload.append('description', formData.description.trim());
            payload.append('category', formData.category);
            payload.append('sku', formData.sku.trim());
            payload.append('price', String(priceNum));
            payload.append('stock', String(stockNum));
            if (formData.image) payload.append('image', formData.image);

            const response = await apiFetch(`/products/${id}`, { method: 'PUT', body: payload });
            const result = await response.json();

            if (result.success) {
                toast.success('Product updated successfully!');
                navigate('/business/products');
            } else {
                toast.error(result.message || 'Failed to update product');
            }
        } catch (error) {
            console.error('Error updating product:', error);
            toast.error('An error occurred while updating the product');
        } finally {
            setLoading(false);
        }
    };

    /**
     * The shell renders in the loading state too. It used to return a bare
     * centred spinner with no sidebar at all, so the navigation rail popped into
     * existence and shoved the page sideways once the fetch resolved.
     */
    if (loadingData) {
        return (
            <BusinessPageShell title="Edit Product" width="standard">
                <Loading label="Loading product…" />
            </BusinessPageShell>
        );
    }

    return (
        <BusinessPageShell
            title="Edit Product"
            subtitle={formData.name || 'Update this catalog item'}
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
                        {loading ? 'Saving…' : 'Save Changes'}
                    </Button>
                </>
            }
        >
            {/* One column on a phone, three from lg up — this was an
                unconditional `grid grid-cols-3`. */}
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
                        {/* Same grouping as Add Product. Category had drifted into
                            "Pricing & Inventory" on this form only, so the two
                            sibling screens described a product differently. */}
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
                                    className="min-h-[120px] border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Category" required>
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

                            <Field label="SKU">
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
                </div>
            </div>
        </BusinessPageShell>
    );
};

export default EditProduct;
