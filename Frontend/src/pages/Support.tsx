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

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/apiClient';
import { useAuthState } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { FileUpload } from '../components/FileUpload';
import { Spotlight } from '../components/ui/Spotlight';

// --- Types ---

interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

interface TicketSubmitData {
  subject: string;
  message: string;
  name?: string;
  email?: string;
  captchaToken: string;
  attachments?: string[];
}

const FAQS = [
  {
    question: 'How quickly will I receive a response?',
    answer:
      'Our support team typically responds within 24 hours during business days (Monday-Friday). For urgent issues, we prioritize tickets and aim to respond within 4-6 hours.',
    category: 'General',
  },
  {
    question: 'What information should I include in my support ticket?',
    answer:
      'Please include: your account email, a detailed description of the issue, any error messages you received, and steps to reproduce the problem. Screenshots are also very helpful!',
    category: 'Support',
  },
  {
    question: 'Do you offer phone support?',
    answer:
      'Currently, we provide support via email and live chat. This allows us to maintain detailed records and provide better assistance. For enterprise customers, phone support is available upon request.',
    category: 'General',
  },
  {
    question: 'Can I track my support ticket?',
    answer:
      "Yes! After submitting a ticket, you'll receive a confirmation email with a ticket number. You can reply to that email to add information or check the status of your request.",
    category: 'Support',
  },
  {
    question: 'What if my issue is urgent?',
    answer:
      'For critical issues affecting your service, please mark your ticket as "Urgent" in the subject line or contact us via live chat for immediate assistance. Our team will prioritize your request.',
    category: 'Billing',
  },
  {
    question: 'Do you provide support in multiple languages?',
    answer:
      "Currently, our primary support language is English. However, we're working on expanding our support to include Spanish, French, and German in the near future.",
    category: 'General',
  },
];

const QUICK_HELP_TOPICS = [
  {
    title: 'Password Reset',
    description: 'Trouble accessing your account?',
    subject: 'Password Reset Request',
    message: 'I need help resetting my password. I am unable to access my account.',
    icon: Shield,
  },
  {
    title: 'Billing Support',
    description: 'Questions about payments?',
    subject: 'Billing Support Needed',
    message: 'I have a question regarding my billing/payment. Please assist me with this matter.',
    icon: FileText,
  },
  {
    title: 'Feature Request',
    description: 'Have an idea for us?',
    subject: 'Feature Request',
    message: 'I would like to suggest a new feature for FairArena: ',
    icon: Sparkles,
  },
];

// --- Components ---

const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case 'OPEN':
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 dark:text-blue-400"
        >
          Open
        </Badge>
      );
    case 'IN_PROGRESS':
      return (
        <Badge
          variant="outline"
          className="bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800 dark:text-yellow-400"
        >
          In Progress
        </Badge>
      );
    case 'RESOLVED':
      return (
        <Badge
          variant="outline"
          className="bg-green-500/10 text-green-600 border-green-200 dark:border-green-800 dark:text-green-400"
        >
          Resolved
        </Badge>
      );
    case 'CLOSED':
      return <Badge variant="secondary">Closed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function Support() {
  const { isDark } = useTheme();
  const { isSignedIn, user } = useAuthState();
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  const [activeTab, setActiveTab] = useState('new-ticket');
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    subject: '',
    message: '',
  });
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isCaptchaDialogOpen, setIsCaptchaDialogOpen] = useState(false);
  const recaptchaRef = useRef<ReCAPTCHA>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Query for user's tickets
  const { data: ticketsData, isLoading: isLoadingTickets } = useQuery({
    queryKey: ['support-tickets'],
    queryFn: () =>
      apiRequest<{ success: boolean; supportTickets: SupportTicket[] }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/support`,
      ),
    enabled: isSignedIn,
  });

  const submitMutation = useMutation({
    mutationFn: async (submitData: TicketSubmitData) => {
      const { captchaToken: token, ...body } = submitData;
      return apiRequest<{ message: string }>(
        `${import.meta.env.VITE_API_BASE_URL}/api/v1/support`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Recaptcha-Token': token,
          },
          body: JSON.stringify(body),
        },
      );
    },
    onSuccess: () => {
      toast.success('Ticket submitted successfully!', {
        description: 'We have received your request and will get back to you shortly.',
      });
      setFormData({
        name: '',
        email: user?.email || '',
        subject: '',
        message: '',
      });
      setUploadedFiles([]);
      setCaptchaToken(null);
      setIsCaptchaDialogOpen(false);
      recaptchaRef.current?.reset();
      // Switch to tickets tab if user is signed in
      if (isSignedIn) {
        setActiveTab('my-tickets');
      }
    },
    onError: (error: Error | { message?: string }) => {
      console.error('Error submitting ticket:', error);
      toast.error('Failed to submit ticket', {
        description:
          ('message' in error ? error.message : 'Please check your connection and try again.') ||
          'Please check your connection and try again.',
      });
      setCaptchaToken(null);
      recaptchaRef.current?.reset();
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuickTopic = (topic: (typeof QUICK_HELP_TOPICS)[0]) => {
    setFormData((prev) => ({
      ...prev,
      subject: topic.subject,
      message: topic.message,
    }));
    setActiveTab('new-ticket');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation before showing captcha
    if (
      !formData.subject ||
      !formData.message ||
      (!isSignedIn && (!formData.name || !formData.email))
    ) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setIsCaptchaDialogOpen(true);
  };

  const handleFinalSubmit = () => {
    if (!captchaToken) {
      toast.error('Please complete the CAPTCHA verifcation.');
      return;
    }
    submitMutation.mutate({
      ...formData,
      ...(isSignedIn ? {} : { email: formData.email }),
      captchaToken,
      attachments: uploadedFiles,
    });
  };

  const onCaptchaChange = useCallback((token: string | null) => setCaptchaToken(token), []);

  const filteredFaqs = FAQS.filter(
    (f) =>
      f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.answer.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className={cn(
        'min-h-screen w-full bg-background relative overflow-x-hidden flex flex-col items-center pb-12 px-4 md:px-8',
        isDashboard ? 'pt-4 md:pt-8' : 'pt-32 md:pt-40',
      )}
    >
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill={isDark ? '#DDFF00' : '#b5c800'}
      />

      {/* Header */}
      <div className="w-full max-w-7xl z-10 mb-10 text-center space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/50 backdrop-blur-sm mb-6 text-xs font-medium text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>Support Center</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
            How can we <span className="text-primary">help?</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Find answers to common questions or reach out to our team directly. We are here to
            ensure your experience is seamless.
          </p>
        </motion.div>
      </div>

      {/* Main Tabs Layout */}
      <div className="w-full max-w-7xl z-10 grid gap-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
            <TabsList className="grid w-full md:w-auto grid-cols-3 h-11 p-1 bg-muted/50 backdrop-blur-sm">
              <TabsTrigger value="new-ticket" className="gap-2">
                <Plus className="w-4 h-4" /> New Ticket
              </TabsTrigger>
              <TabsTrigger value="my-tickets" className="gap-2" disabled={!isSignedIn}>
                <Ticket className="w-4 h-4" /> My Tickets
              </TabsTrigger>
              <TabsTrigger value="faq" className="gap-2">
                <HelpCircle className="w-4 h-4" /> FAQs
              </TabsTrigger>
            </TabsList>

            {/* Quick Contact Links */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild className="hidden md:flex gap-2">
                <a href="mailto:support@fairarena.app">
                  <Mail className="w-3.5 h-3.5" /> Email Us
                </a>
              </Button>
            </div>
          </div>

          {/* New Ticket Tab */}
          <TabsContent value="new-ticket" className="mt-0">
            <div className="grid lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2">
                <Card className="border shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden relative">
                  <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary/10" />
                  <CardHeader>
                    <CardTitle>Submit a Request</CardTitle>
                    <CardDescription>
                      Detailed information helps us resolve your issue faster.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleInitialSubmit} className="space-y-6">
                      {/* User Details (if not signed in) */}
                      {!isSignedIn && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                              id="name"
                              name="name"
                              placeholder="John Doe"
                              value={formData.name}
                              onChange={handleChange}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              name="email"
                              type="email"
                              placeholder="john@example.com"
                              value={formData.email}
                              onChange={handleChange}
                              required
                            />
                          </div>
                        </div>
                      )}

                      {isSignedIn && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10 text-sm mb-4">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                            <span className="font-semibold text-primary">
                              {user?.email?.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">
                              Submitting as {user?.firstName} {user?.lastName}
                            </p>
                            <p className="text-muted-foreground">{user?.email}</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          name="subject"
                          placeholder="Brief summary of your issue"
                          value={formData.subject}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          name="message"
                          placeholder="Provide detailed information..."
                          className="min-h-[150px] resize-y"
                          value={formData.message}
                          onChange={handleChange}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Attachments (Optional)</Label>
                        <div className="border-2 border-dashed rounded-lg p-6 hover:bg-muted/50 transition-colors">
                          <FileUpload
                            onUploadComplete={(blobName: string) => {
                              setUploadedFiles((prev) => [...prev, blobName]);
                              setUploadError('');
                            }}
                            onUploadError={(error: string) => setUploadError(error)}
                            maxSizeMB={100}
                          />
                        </div>
                        {uploadError && (
                          <p className="text-sm text-destructive mt-2">{uploadError}</p>
                        )}
                        {uploadedFiles.length > 0 && (
                          <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> {uploadedFiles.length} file(s)
                            attached
                          </p>
                        )}
                      </div>

                      <Button type="submit" className="w-full h-11 text-base">
                        <span className="flex items-center gap-2">
                          <Send className="w-4 h-4" /> Submit Ticket
                        </span>
                      </Button>

                      <p className="text-xs text-center text-muted-foreground pt-2">
                        By submitting this form, you agree to our{' '}
                        <Link to="/terms" className="underline hover:text-primary">
                          Terms
                        </Link>{' '}
                        and{' '}
                        <Link to="/privacy" className="underline hover:text-primary">
                          Privacy Policy
                        </Link>
                        .
                      </p>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <Card className="bg-muted/30 border-none shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Common Topics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {QUICK_HELP_TOPICS.map((topic, i) => (
                      <button
                        key={i}
                        onClick={() => handleQuickTopic(topic)}
                        className="w-full text-left p-3 rounded-md bg-background border hover:border-primary/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <topic.icon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{topic.title}</p>
                            <p className="text-xs text-muted-foreground">{topic.description}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-secondary/10 border-none shadow-none">
                  <CardContent className="p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center mx-auto shadow-sm">
                      <MessageCircle className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Live Chat</h3>
                      <p className="text-sm text-muted-foreground">
                        Available Mon-Fri, 9am-5pm EST
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => toast('Chat is currently offline. Please submit a ticket.')}
                    >
                      Start Chat
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* My Tickets Tab (Auth only) */}
          <TabsContent value="my-tickets" className="mt-0">
            <Card className="min-h-[400px]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>My Tickets</CardTitle>
                    <CardDescription>View and manage your support requests.</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      ticketsData &&
                      !isLoadingTickets &&
                      apiRequest(`${import.meta.env.VITE_API_BASE_URL}/api/v1/support`)
                    }
                  >
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!isSignedIn ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Shield className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
                    <p className="text-muted-foreground max-w-sm mb-6">
                      Please sign in to view your support ticket history.
                    </p>
                    <Button asChild>
                      <Link to="/auth/sign-in">Sign In</Link>
                    </Button>
                  </div>
                ) : isLoadingTickets ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-md" />
                    ))}
                  </div>
                ) : ticketsData?.supportTickets.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl">
                    <Ticket className="w-12 h-12 text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Tickets Found</h3>
                    <p className="text-muted-foreground max-w-sm">
                      You haven't submitted any support tickets yet.
                    </p>
                    <Button variant="link" onClick={() => setActiveTab('new-ticket')}>
                      Submit a Ticket
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {ticketsData?.supportTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-base">{ticket.subject}</span>
                              <StatusBadge status={ticket.status} />
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {ticket.message}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />{' '}
                                {new Date(ticket.createdAt).toLocaleDateString()}
                              </span>
                              <span>ID: {ticket.id.slice(0, 8)}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0 gap-1">
                            View Details <MessageSquare className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="mt-0">
            <div className="max-w-3xl mx-auto space-y-8">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search FAQs..."
                  className="pl-10 h-11 bg-card/80 backdrop-blur-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="grid gap-4">
                <AnimatePresence>
                  {filteredFaqs.length > 0 ? (
                    filteredFaqs.map((faq, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card className="overflow-hidden hover:border-primary/40 transition-colors">
                          <CardHeader className="py-4 cursor-pointer">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                              <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                              {faq.question}
                            </CardTitle>
                          </CardHeader>
                          <Separator />
                          <CardContent className="py-4 bg-muted/5 text-sm leading-relaxed text-muted-foreground">
                            {faq.answer}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p>No results found for "{searchQuery}"</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Verification Dialog */}
      <Dialog open={isCaptchaDialogOpen} onOpenChange={setIsCaptchaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Security Verification</DialogTitle>
            <DialogDescription>
              Please complete the CAPTCHA below to submit your ticket.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={import.meta.env.VITE_GOOGLE_RECAPTCHA_SITE_KEY || ''}
              onChange={onCaptchaChange}
              theme={isDark ? 'dark' : 'light'}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCaptchaDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalSubmit}
              disabled={!captchaToken || submitMutation.isPending}
            >
              {submitMutation.isPending ? 'Sending...' : 'Confirm & Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
