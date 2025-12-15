import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Item {
    id: string;
    title?: string;
    description: string;
    status: string;
    createdAt: string;
    updatedAt?: string;
}

interface ItemListModalProps {
    title: string;
    description: string;
    fetchItems: () => Promise<Item[]>;
    triggerText: string;
    statusVariants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'>;
    statusLabels: Record<string, string>;
}

export function ItemListModal({
    title,
    description,
    fetchItems,
    triggerText,
    statusVariants,
    statusLabels,
}: ItemListModalProps) {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (open && items.length === 0) {
            const loadItems = async () => {
                setIsLoading(true);
                try {
                    const fetchedItems = await fetchItems();
                    setItems(fetchedItems);
                } catch (error) {
                    console.error('Failed to fetch items:', error);
                } finally {
                    setIsLoading(false);
                }
            };
            loadItems();
        } else if (!open) {
            // Reset items when modal closes
            setItems([]);
        }
    }, [open, fetchItems, items.length]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                    {triggerText}
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span>Loading...</span>
                        </div>
                    ) : items.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">No items found.</p>
                    ) : (
                        <div className="space-y-4">
                            {items.map((item) => (
                                <div key={item.id} className="border rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium">{item.title || 'Item'}</h4>
                                        <Badge variant={statusVariants[item.status] || 'secondary'}>
                                            {statusLabels[item.status] || item.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mb-2">{item.description}</p>
                                    <div className="text-xs text-muted-foreground">
                                        Submitted: {new Date(item.createdAt).toLocaleDateString()}
                                        {item.updatedAt && item.updatedAt !== item.createdAt && (
                                            <span> • Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
