import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { api } from '../services/api';

interface FeedbackData {
    id: string;
    feedbackCode: string;
    message?: string;
    rating?: number;
    isUsed: boolean;
    createdAt: string;
}

const Feedback = () => {
    const { feedbackCode } = useParams<{ feedbackCode: string }>();
    const [feedback, setFeedback] = useState<FeedbackData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState<number | null>(null);
    const [hoveredRating, setHoveredRating] = useState<number | null>(null);

    useEffect(() => {
        const fetchFeedback = async () => {
            if (!feedbackCode) return;

            try {
                const response = await api.get<FeedbackData>(`/api/v1/feedback/${feedbackCode}`);
                setFeedback(response);
            } catch (error: unknown) {
                const err = error as { response?: { status: number } };
                if (err.response?.status === 404) {
                    toast.error('Feedback link not found or expired');
                } else {
                    toast.error('Failed to load feedback form');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchFeedback();
    }, [feedbackCode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!feedback || !feedbackCode || !rating) return;

        setSubmitting(true);
        try {
            await api.post(`/api/v1/feedback/${feedbackCode}`, {
                message: message.trim() || undefined,
                rating,
            });
            toast.success('Thank you for your feedback!');
            setFeedback({ ...feedback, isUsed: true, message, rating });
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Failed to submit feedback');
        } finally {
            setSubmitting(false);
        }
    };

    const getRatingText = (value: number) => {
        switch (value) {
            case 1: return 'Poor';
            case 2: return 'Fair';
            case 3: return 'Good';
            case 4: return 'Very good';
            case 5: return 'Excellent';
            default: return '';
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
                <div className="flex flex-col items-center gap-3 text-slate-600 dark:text-slate-400 w-full">
                    <div className="h-10 w-10 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
                    <span className="text-lg font-medium">Loading feedback form…</span>
                </div>
            </div>
        );
    }

    if (!feedback) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-0">
                <div className="w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-none p-8 flex flex-col items-center justify-center min-h-[400px]">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 text-center">Invalid feedback link</h2>
                    <p className="text-lg text-slate-600 dark:text-slate-400 mb-4 text-center">This feedback link is not valid or has expired.</p>
                    <p className="text-base text-slate-500 dark:text-slate-400 mb-6 text-center">If you think this is a mistake, please contact support.</p>
                    <Button
                        onClick={() => (window.location.href = '/')}
                        className="w-full max-w-xs bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white"
                        variant="outline"
                    >
                        Go to homepage
                    </Button>
                </div>
            </div>
        );
    }

    if (feedback.isUsed) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
                <Card className="w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 rounded-none">
                    <CardHeader className="space-y-2 text-center">
                        <CardTitle className="text-slate-900 dark:text-slate-100">Thank you</CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">
                            Your feedback has already been recorded.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {feedback.rating && (
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <svg
                                            key={star}
                                            className={`h-4 w-4 ${star <= feedback.rating! ? 'text-amber-500' : 'text-slate-300 dark:text-slate-600'
                                                }`}
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path d="M9.049.927c.3-.921 1.603-.921 1.902 0l1.19 3.674a1 1 0 00.95.69h3.862c.969 0 1.371 1.24.588 1.81l-3.125 2.27a1 1 0 00-.364 1.118l1.19 3.674c.3.922-.755 1.688-1.538 1.118l-3.125-2.27a1 1 0 00-1.176 0l-3.125 2.27c-.783.57-1.838-.196-1.538-1.118l1.19-3.674a1 1 0 00-.364-1.118L1.36 7.1c-.783-.57-.38-1.81.588-1.81h3.862a1 1 0 00.95-.69L9.049.927z" />
                                        </svg>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {feedback.rating}/5 · {getRatingText(feedback.rating)}
                                </p>
                            </div>
                        )}

                        {feedback.message && (
                            <div className="rounded-md border bg-slate-50 dark:bg-slate-700/50 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600">
                                “{feedback.message}”
                            </div>
                        )}

                        <Button
                            onClick={() => (window.location.href = '/')}
                            className="w-full bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white"
                        >
                            Return to FairArena
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const currentRating = hoveredRating || rating || 0;

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-10">
            <div className="mx-auto w-full max-w-xl">
                <Card className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700">
                    <CardHeader className="space-y-2">
                        <CardTitle className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Share your feedback
                        </CardTitle>
                        <CardDescription className="text-slate-600 dark:text-slate-400">
                            Help us improve FairArena with a quick rating and an optional comment.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Rating */}
                            <div className="space-y-2">
                                <div className="flex items-baseline justify-between">
                                    <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        Overall experience <span className="text-red-500">*</span>
                                    </label>
                                    {currentRating > 0 && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {currentRating}/5 · {getRatingText(currentRating)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setRating(star)}
                                            onMouseEnter={() => setHoveredRating(star)}
                                            onMouseLeave={() => setHoveredRating(null)}
                                            className="group rounded-full p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900"
                                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                                        >
                                            <svg
                                                className={`h-6 w-6 transition-colors ${star <= currentRating
                                                        ? 'text-amber-500'
                                                        : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400 dark:group-hover:text-slate-500'
                                                    }`}
                                                viewBox="0 0 20 20"
                                                fill="currentColor"
                                            >
                                                <path d="M9.049.927c.3-.921 1.603-.921 1.902 0l1.19 3.674a1 1 0 00.95.69h3.862c.969 0 1.371 1.24.588 1.81l-3.125 2.27a1 1 0 00-.364 1.118l1.19 3.674c.3.922-.755 1.688-1.538 1.118l-3.125-2.27a1 1 0 00-1.176 0l-3.125 2.27c-.783.57-1.838-.196-1.538-1.118l1.19-3.674a1 1 0 00-.364-1.118L1.36 7.1c-.783-.57-.38-1.81.588-1.81h3.862a1 1 0 00.95-.69L9.049.927z" />
                                            </svg>
                                        </button>
                                    ))}
                                </div>

                                {!rating && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Click a star to select your rating.
                                    </p>
                                )}
                            </div>

                            {/* Message */}
                            <div className="space-y-2">
                                <div className="flex items-baseline justify-between">
                                    <label htmlFor="message" className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                        Additional comments
                                    </label>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        Optional
                                    </span>
                                </div>

                                <Textarea
                                    id="message"
                                    placeholder="What worked well? What could be improved?"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                                    rows={4}
                                    className="resize-none bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400"
                                />

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">
                                        {message.length}/1000 characters
                                    </span>
                                    {message.length > 900 && (
                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                            {1000 - message.length} remaining
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={submitting || !rating}
                                className="w-full bg-slate-600 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white disabled:bg-slate-400 dark:disabled:bg-slate-600"
                            >
                                {submitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                        <span>Submitting…</span>
                                    </span>
                                ) : (
                                    'Submit feedback'
                                )}
                            </Button>

                            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                                Your response is anonymous and used only to improve FairArena.
                            </p>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Feedback;
