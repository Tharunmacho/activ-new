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
        /*
         * NAME AND PRICE. NOT CATEGORY — THIS FORM HAS NO CATEGORY FIELD.
         *
         * The category and SKU inputs were removed from both product forms
         * deliberately: the company answers "what do you make" once, on its own
         * profile, against NIC. `AddProduct` dropped `category` from its guard
         * at the same time; this one did not, so it went on requiring a value
         * from a control that is no longer on the screen.
         *
         * The result was a form that could not be submitted at all. Every field
         * it showed was filled in and it answered "Please fill in all required
         * fields" — naming no field, because the field it meant was not there
         * to name. `normalizeProductCategory` makes it worse rather than
         * better: it blanks any category the current lists do not recognise, so
         * even a product that HAS one arrives here with ''.
         */
        if (!formData.name || !formData.price) {
            toast.error("A product needs a name and a price");
            return;
        }

        const priceNum = parseFloat(formData.price);
        if (isNaN(priceNum) || priceNum < 0) {
            toast.error("Please enter a valid price");
            return;
        }

        /* No stock check: the field came off this form, so there is no
           number to validate. */

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
            /*
             * Only sent when there is one to send.
             *
             * `formData.category` is '' for any product whose stored category
             * the current lists no longer recognise, and the server writes
             * whichever keys arrive — so appending it unconditionally erased a
             * real category on every save, from a form that does not show the
             * field and gives nobody a chance to notice. Omitted, the stored
             * value is left alone, exactly as `imageUrl` is above.
             */
            if (formData.category) payload.append('category', formData.category);
            if (formData.sku.trim()) payload.append('sku', formData.sku.trim());
            payload.append('price', String(priceNum));
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
            {/* ONE CARD, as on Add Product — a picture, a name, a price and a
                description. See the note there for why the three-card grid went;
                and there is no stock count: nothing member-facing reads it and a
                figure nobody updates tells a visitor something untrue. */}
            <div className="mx-auto w-full max-w-4xl">
                <Card>
                    <SectionHeading title="Product" icon={Package} />

                    <div className="grid gap-6 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] items-start">
                        <div>
                            <label
                                htmlFor="product-image"
                                className="block rounded-xl border-2 border-dashed border-slate-300
                                           hover:border-blue-500 transition-colors cursor-pointer
                                           overflow-hidden bg-slate-50"
                            >
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Product preview"
                                        className="w-full h-52 object-cover" />
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-52 px-4 text-center">
                                        <ImagePlus className="h-9 w-9 text-slate-400 mb-2.5" />
                                        <p className="text-[1.25rem] font-semibold text-slate-700">Add a picture</p>
                                        <p className="text-[1.1875rem] text-slate-500 mt-1">JPG or PNG, max 5MB</p>
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
                                <p className="text-[1.1875rem] text-slate-500 mt-2 text-center">
                                    Click the image to change it
                                </p>
                            ) : null}
                        </div>

                        <div className="space-y-5">
                            <Field label="Product Name" required full>
                                <Input
                                    placeholder="Enter product / service name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-11 border-slate-200 focus-visible:ring-blue-500"
                                />
                            </Field>

                            <Field label="Price (₹)" required full>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="0.00"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
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
                        </div>
                    </div>
                </Card>
            </div>
        </BusinessPageShell>
    );
};

export default EditProduct;
