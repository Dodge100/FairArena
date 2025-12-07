import { Eye, EyeOff, GripVertical, Settings } from 'lucide-react';
import { useState } from 'react';
import { useSidebarCustomization, type SidebarItem } from '../contexts/SidebarCustomizationContext';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Switch } from './ui/switch';

interface SidebarCustomizationModalProps {
    children: React.ReactNode;
}

export function SidebarCustomizationModal({ children }: SidebarCustomizationModalProps) {
    const { customization, updateItemVisibility, reorderItems, resetToDefault } = useSidebarCustomization();
    const [isOpen, setIsOpen] = useState(false);
    const [draggedItem, setDraggedItem] = useState<string | null>(null);

    const handleDragStart = (itemId: string) => {
        setDraggedItem(itemId);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetId: string, isMain: boolean) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === targetId) return;

        const items = isMain ? [...customization.mainItems] : [...customization.secondaryItems];
        const draggedIndex = items.findIndex(item => item.id === draggedItem);
        const targetIndex = items.findIndex(item => item.id === targetId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Remove dragged item and insert at new position
        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);

        reorderItems(items, isMain);
        setDraggedItem(null);
    };

    const renderItem = (item: SidebarItem, isMain: boolean) => (
        <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(item.id)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, item.id, isMain)}
            className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors cursor-move"
        >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {item.badge && (
                        <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                            {item.badge}
                        </span>
                    )}
                </div>
                <div className="text-sm text-muted-foreground">{item.url}</div>
            </div>
            <div className="flex items-center gap-2">
                {item.visible ? (
                    <Eye className="h-4 w-4 text-green-600" />
                ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <Switch
                    checked={item.visible}
                    onCheckedChange={(checked) => updateItemVisibility(item.id, checked, isMain)}
                />
            </div>
        </div>
    );

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        Customize Sidebar
                    </DialogTitle>
                    <DialogDescription>
                        Reorder and hide/show sidebar items to personalize your navigation experience.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Main Menu Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Main Menu</CardTitle>
                            <CardDescription>
                                Primary navigation items. Drag to reorder, toggle visibility.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {customization.mainItems
                                .sort((a, b) => a.order - b.order)
                                .map(item => renderItem(item, true))}
                        </CardContent>
                    </Card>

                    {/* Secondary Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Tools & Settings</CardTitle>
                            <CardDescription>
                                Secondary navigation items. Drag to reorder, toggle visibility.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {customization.secondaryItems
                                .sort((a, b) => a.order - b.order)
                                .map(item => renderItem(item, false))}
                        </CardContent>
                    </Card>

                    {/* Reset Button */}
                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => {
                                resetToDefault();
                            }}
                        >
                            Reset to Default
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
