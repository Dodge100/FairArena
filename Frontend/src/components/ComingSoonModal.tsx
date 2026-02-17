import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Rocket, Sparkles } from 'lucide-react';

interface ComingSoonModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feature?: string;
}

export function ComingSoonModal({ open, onOpenChange, feature = 'This feature' }: ComingSoonModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                            <div className="relative bg-primary/10 p-4 rounded-full border-2 border-primary/20">
                                <Rocket className="w-12 h-12 text-primary" />
                            </div>
                        </div>
                    </div>
                    <DialogTitle className="text-center text-2xl">Coming Soon!</DialogTitle>
                    <DialogDescription className="text-center space-y-3 pt-2">
                        <p className="text-base">
                            {feature} is currently under development and will be available soon.
                        </p>
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Sparkles className="w-4 h-4" />
                            <span>We're working hard to bring you something amazing!</span>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-center pt-4">
                    <Button onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                        Got it!
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
