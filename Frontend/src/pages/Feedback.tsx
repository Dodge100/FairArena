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

    const getRatingText = (rating: number) => {
        switch (rating) {
            case 1: return 'Poor';
            case 2: return 'Fair';
            case 3: return 'Good';
            case 4: return 'Very Good';
            case 5: return 'Excellent';
            default: return '';
        }
    };

    const getRatingColor = (rating: number) => {
        switch (rating) {
            case 1: return 'text-red-500';
            case 2: return 'text-orange-500';
            case 3: return 'text-yellow-500';
            case 4: return 'text-lime-500';
            case 5: return 'text-green-500';
            default: return 'text-gray-400';
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-6"></div>
                    <h2 className="text-2xl font-bold mb-2">Loading Feedback Form</h2>
                    <p className="text-indigo-100">Please wait while we prepare your feedback experience...</p>
                </div>
            </div>
        );
    }

    if (!feedback) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-linear-to-br from-red-500 via-pink-500 to-red-600">
                <Card className="w-full max-w-lg mx-4 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto mb-6 w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                        <CardTitle className="text-2xl font-bold text-red-700">Invalid Feedback Link</CardTitle>
                        <CardDescription className="text-red-600 text-lg">
                            This feedback link is not valid or has expired.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                        <p className="text-gray-600 mb-6">
                            If you believe this is an error, please contact our support team.
                        </p>
                        <Button
                            onClick={() => window.location.href = '/'}
                            className="bg-red-600 hover:bg-red-700 text-white px-8 py-3"
                        >
                            Go to Homepage
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (feedback.isUsed) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-linear-to-br from-green-500 via-emerald-500 to-teal-600">
                <Card className="w-full max-w-lg mx-4 shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto mb-6 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <CardTitle className="text-3xl font-bold text-green-700 mb-2">Thank You!</CardTitle>
                        <CardDescription className="text-green-600 text-lg">
                            Your feedback has been successfully recorded
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {feedback.rating && (
                            <div className="text-center">
                                <div className="flex justify-center mb-3">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span
                                            key={star}
                                            className={`text-2xl ${star <= feedback.rating! ? getRatingColor(feedback.rating!) : 'text-gray-300'}`}
                                        >
                                            ★
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xl font-semibold text-gray-800">
                                    {feedback.rating}/5 - {getRatingText(feedback.rating)}
                                </p>
                            </div>
                        )}
                        {feedback.message && (
                            <div className="bg-gray-50 rounded-xl p-4 border-l-4 border-green-500">
                                <p className="text-gray-700 italic text-lg leading-relaxed">"{feedback.message}"</p>
                            </div>
                        )}
                        <div className="text-center pt-4">
                            <Button
                                onClick={() => window.location.href = '/'}
                                className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 text-lg"
                            >
                                Return to FairArena
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-linear-to-br from-indigo-600 via-purple-600 to-pink-600 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4">
                <Card className="w-full max-w-4xl shadow-2xl border-0 bg-white/95 backdrop-blur-sm mx-auto">
                    <CardHeader className="text-center pb-8 pt-12">
                        <div className="mx-auto mb-6 w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <CardTitle className="text-4xl font-bold text-gray-900 mb-4">
                            We'd Love Your Feedback!
                        </CardTitle>
                        <CardDescription className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
                            Your thoughts help us improve FairArena and create a better experience for everyone.
                            Please take a moment to share your experience with us.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-8 pb-12">
                        <form onSubmit={handleSubmit} className="space-y-10">
                            {/* Rating - Required */}
                            <div className="space-y-6">
                                <div className="text-center">
                                    <label className="block text-2xl font-bold text-gray-900 mb-2">
                                        How would you rate your experience?
                                    </label>
                                    <p className="text-lg text-red-500 font-semibold">* Required</p>
                                </div>

                                <div className="flex flex-col items-center space-y-6">
                                    <div className="flex gap-3">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                onClick={() => setRating(star)}
                                                onMouseEnter={() => setHoveredRating(star)}
                                                onMouseLeave={() => setHoveredRating(null)}
                                                className={`text-5xl transition-all duration-300 transform hover:scale-125 ${star <= (hoveredRating || rating || 0)
                                                    ? getRatingColor(hoveredRating || rating || 0)
                                                    : 'text-gray-300 hover:text-gray-400'
                                                    } drop-shadow-lg`}
                                            >
                                                ★
                                            </button>
                                        ))}
                                    </div>

                                    {(rating || hoveredRating) && (
                                        <div className="text-center bg-gray-50 rounded-xl p-4 min-w-48">
                                            <p className={`text-2xl font-bold ${getRatingColor(hoveredRating || rating!)}`}>
                                                {getRatingText(hoveredRating || rating!)}
                                            </p>
                                            <p className="text-lg text-gray-600 mt-1">
                                                {(hoveredRating || rating)} out of 5 stars
                                            </p>
                                        </div>
                                    )}

                                    {!rating && (
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                            <p className="text-red-700 font-semibold text-center">
                                                ⚠️ Please select a rating to continue
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Message - Optional */}
                            <div className="space-y-4">
                                <div className="text-center">
                                    <label htmlFor="message" className="block text-2xl font-bold text-gray-900 mb-2">
                                        Tell us more about your experience
                                    </label>
                                    <p className="text-lg text-gray-500">Optional - but your detailed feedback helps us improve</p>
                                </div>

                                <div className="max-w-2xl mx-auto">
                                    <Textarea
                                        id="message"
                                        placeholder="What did you like? What could we improve? Any suggestions or specific feedback you'd like to share..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={6}
                                        className="resize-none text-lg border-2 border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl p-4"
                                    />
                                    <div className="flex justify-between items-center mt-2">
                                        <p className="text-sm text-gray-500">
                                            {message.length}/1000 characters
                                        </p>
                                        {message.length > 900 && (
                                            <p className="text-sm text-orange-600 font-semibold">
                                                {1000 - message.length} characters remaining
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-center pt-8">
                                <Button
                                    type="submit"
                                    disabled={submitting || !rating}
                                    className="px-16 py-4 text-xl font-bold bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105 disabled:hover:scale-100 rounded-xl"
                                >
                                    {submitting ? (
                                        <div className="flex items-center space-x-3">
                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                                            <span>Submitting Your Feedback...</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center space-x-2">
                                            <span>Submit Feedback</span>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                            </svg>
                                        </div>
                                    )}
                                </Button>
                            </div>

                            {/* Footer */}
                            <div className="text-center pt-8 border-t border-gray-200">
                                <p className="text-gray-500 text-sm">
                                    Your feedback is anonymous and helps us build a better FairArena for everyone.
                                </p>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default Feedback;
