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
import {
  AlertCircle,
  Bug,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';

interface Item {
  id: string;
  title?: string;
  description: string;
  fullMessage?: string;
  status: string;
  type?: string;
  severity?: string;
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

// Helper function to get severity badge color
const getSeverityVariant = (
  severity?: string,
): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
      return 'destructive';
    case 'HIGH':
      return 'destructive';
    case 'MEDIUM':
      return 'outline';
    case 'LOW':
      return 'secondary';
    default:
      return 'secondary';
  }
};

// Helper function to get type icon
const getTypeIcon = (type?: string) => {
  switch (type?.toUpperCase()) {
    case 'BUG':
      return Bug;
    case 'FEATURE_REQUEST':
      return Sparkles;
    case 'QUERY':
      return HelpCircle;
    case 'SUGGESTION':
      return Lightbulb;
    default:
      return MessageSquare;
  }
};

// Helper function to format type for display
const formatType = (type?: string) => {
  if (!type) return 'Other';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

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
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

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

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen && items.length === 0) {
      loadItems();
    } else if (!newOpen) {
      setItems([]);
      setExpandedItems(new Set());
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          {triggerText}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading...</span>
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No items found.</p>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                const TypeIcon = getTypeIcon(item.type);
                const hasFullMessage = item.fullMessage && item.fullMessage !== item.description;

                return (
                  <div
                    key={item.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {/* Header with Title and Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <h4 className="font-semibold text-base flex-1">{item.title || 'Item'}</h4>
                      <Badge
                        variant={statusVariants[item.status] || 'secondary'}
                        className="shrink-0"
                      >
                        {statusLabels[item.status] || item.status}
                      </Badge>
                    </div>

                    {/* Classification Badges */}
                    {(item.type || item.severity) && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {item.type && (
                          <Badge variant="outline" className="flex items-center gap-1.5">
                            <TypeIcon className="w-3 h-3" />
                            <span className="text-xs">{formatType(item.type)}</span>
                          </Badge>
                        )}
                        {item.severity && (
                          <Badge
                            variant={getSeverityVariant(item.severity)}
                            className="flex items-center gap-1.5"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span className="text-xs">{item.severity}</span>
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Description (AI Summary) */}
                    <div className="bg-muted/50 rounded-md p-3 mb-3">
                      <p className="text-sm text-foreground leading-relaxed">{item.description}</p>
                    </div>

                    {/* Expandable Full Message */}
                    {hasFullMessage && (
                      <div className="mb-3">
                        <button
                          onClick={() => toggleExpanded(item.id)}
                          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              Hide full message
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              Show full message
                            </>
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 p-3 bg-background border rounded-md">
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {item.fullMessage}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Created:{' '}
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {item.updatedAt && item.updatedAt !== item.createdAt && (
                        <span>
                          • Updated:{' '}
                          {new Date(item.updatedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
