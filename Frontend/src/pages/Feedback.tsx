/**
 * @license
 * Copyright (c) 2026 FairArena. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * This source code is the sole property of FairArena. Unauthorized copying,
 * distribution, or use of this file, via any medium, is strictly prohibited.
 *
 * This file and its contents are provided "AS IS" without warranty of any kind,
 * either express or implied, including, but not limited to, the implied
 * warranties of merchantability and fitness for a particular purpose.
 */

import { AlertCircle, CheckCircle2, Loader2, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
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
      case 1:
        return 'Poor';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Very Good';
      case 5:
        return 'Excellent';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-4xl min-w-[500px] border-border bg-card/50 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Link Expired</CardTitle>
            <CardDescription>
              This feedback link is invalid or has already been used.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => (window.location.href = '/')}
              className="w-full"
              variant="secondary"
            >
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (feedback.isUsed) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 text-foreground">
        <Card className="w-full max-w-4xl min-w-[500px] border-border bg-card/50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-300">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Thank You!</CardTitle>
            <CardDescription>Your feedback has been recorded.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {feedback.rating && (
              <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/50 p-4">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'h-5 w-5',
                        star <= feedback.rating!
                          ? 'fill-primary text-primary'
                          : 'fill-muted text-muted-foreground',
                      )}
                    />
                  ))}
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {getRatingText(feedback.rating)}
                </p>
              </div>
            )}

            {feedback.message && (
              <div className="rounded-lg border bg-muted/30 p-4 text-center text-sm italic text-muted-foreground">
                "{feedback.message}"
              </div>
            )}

            <Button
              onClick={() => (window.location.href = '/')}
              className="w-full"
              variant="outline"
            >
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentRating = hoveredRating || rating || 0;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-4xl min-w-[500px] border-border bg-card/50 backdrop-blur-xl">
        <CardHeader>
          <CardTitle className="text-center text-xl font-semibold">Share Feedback</CardTitle>
          <CardDescription className="text-center">
            How was your experience? We verify every response.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Rating Section */}
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center gap-2">
                <div
                  className="flex items-center gap-1"
                  onMouseLeave={() => setHoveredRating(null)}
                >
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredRating(star)}
                      className="group rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star
                        className={cn(
                          'h-8 w-8 transition-all duration-200',
                          star <= currentRating
                            ? 'fill-primary text-primary scale-110'
                            : 'text-muted-foreground hover:text-muted-foreground/80 hover:scale-105',
                        )}
                        strokeWidth={1.5}
                      />
                    </button>
                  ))}
                </div>
                <span
                  className={cn(
                    'h-6 text-sm font-medium transition-all duration-300',
                    currentRating > 0 ? 'text-primary' : 'text-transparent',
                  )}
                >
                  {currentRating > 0 ? getRatingText(currentRating) : 'Select a rating'}
                </span>
              </div>

              {!rating && submitting && (
                <p className="text-center text-xs text-destructive animate-pulse">
                  Please select a rating to continue
                </p>
              )}
            </div>

            {/* Comment Section */}
            <div className="space-y-3">
              <Label htmlFor="message" className="text-sm font-medium">
                Additional Details
              </Label>
              <Textarea
                id="message"
                placeholder="Tell us what you liked or how we can improve..."
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                rows={4}
                className="resize-none bg-background/50 focus:bg-background transition-colors"
              />
              <div className="flex justify-end">
                <span className="text-xs text-muted-foreground">{message.length}/1000</span>
              </div>
            </div>

            <Button type="submit" disabled={submitting || !rating} className="w-full" size="lg">
              {submitting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting...</span>
                </div>
              ) : (
                'Submit Feedback'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground/60">
              Your feedback helps us make FairArena better for everyone.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Feedback;
