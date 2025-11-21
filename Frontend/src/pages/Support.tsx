import {
  ChevronDown,
  ChevronUp,
  Clock,
  HelpCircle,
  Mail,
  MessageCircle,
  MessageSquare,
  Send,
  Shield,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Spotlight } from '../components/ui/Spotlight';
import { useTheme } from '../hooks/useTheme';

export default function Support() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [showFAQ, setShowFAQ] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);

  const quickHelpTopics = [
    {
      question: 'How do I reset my password?',
      subject: 'Password Reset Request',
      message: 'I need help resetting my password. I am unable to access my account.',
    },
    {
      question: 'Billing and payment issues',
      subject: 'Billing Support Needed',
      message: 'I have a question regarding my billing/payment. Please assist me with this matter.',
    },
    {
      question: 'Account verification',
      subject: 'Account Verification Help',
      message: 'I need assistance with verifying my account. Please guide me through the process.',
    },
    {
      question: 'Feature requests',
      subject: 'Feature Request',
      message: 'I would like to suggest a new feature for FairArena: ',
    },
    {
      question: 'Technical support',
      subject: 'Technical Issue',
      message: 'I am experiencing a technical issue with: ',
    },
  ];

  const faqs = [
    {
      question: 'How quickly will I receive a response?',
      answer:
        'Our support team typically responds within 24 hours during business days (Monday-Friday). For urgent issues, we prioritize tickets and aim to respond within 4-6 hours.',
    },
    {
      question: 'What information should I include in my support ticket?',
      answer:
        'Please include: your account email, a detailed description of the issue, any error messages you received, and steps to reproduce the problem. Screenshots are also very helpful!',
    },
    {
      question: 'Do you offer phone support?',
      answer:
        'Currently, we provide support via email and live chat. This allows us to maintain detailed records and provide better assistance. For enterprise customers, phone support is available upon request.',
    },
    {
      question: 'Can I track my support ticket?',
      answer:
        "Yes! After submitting a ticket, you'll receive a confirmation email with a ticket number. You can reply to that email to add information or check the status of your request.",
    },
    {
      question: 'What if my issue is urgent?',
      answer:
        'For critical issues affecting your service, please mark your ticket as "Urgent" in the subject line or contact us via live chat for immediate assistance. Our team will prioritize your request.',
    },
    {
      question: 'Do you provide support in multiple languages?',
      answer:
        "Currently, our primary support language is English. However, we're working on expanding our support to include Spanish, French, and German in the near future.",
    },
  ];

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleQuickHelp = (topic: (typeof quickHelpTopics)[0]) => {
    setFormData({
      name: formData.name,
      email: formData.email,
      subject: topic.subject,
      message: topic.message,
    });
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleContactMethod = (method: string) => {
    switch (method) {
      case 'email':
        window.open('mailto:fairarena.contact@gmail.com', '_blank');
        break;
      case 'chat':
        // Scroll to form for now, can be integrated with a chat widget later
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      case 'faq':
        setShowFAQ(true);
        setTimeout(() => {
          faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
        break;
    }
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <div
      className={`w-full px-4 py-12 relative overflow-hidden ${showFAQ ? 'flex flex-col' : 'min-h-screen flex flex-col items-center justify-center'}`}
    >
      {/* Spotlight Effects */}
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill={isDark ? '#DDFF00' : '#b5c800'}
      />
      <Spotlight
        className="top-20 right-0 md:top-40 md:right-40"
        fill={isDark ? '#DDFF00' : '#b5c800'}
      />

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-20 left-10 w-72 h-72 rounded-full blur-3xl opacity-20 animate-pulse ${
            isDark ? 'bg-[#DDEF00]' : 'bg-[#b5c800]'
          }`}
          style={{ animationDuration: '4s' }}
        />
        <div
          className={`absolute bottom-20 right-10 w-96 h-96 rounded-full blur-3xl opacity-20 animate-pulse ${
            isDark ? 'bg-[#DDEF00]' : 'bg-[#b5c800]'
          }`}
          style={{ animationDuration: '6s', animationDelay: '2s' }}
        />
      </div>

      {/* Main Content */}
      <div className={`max-w-5xl w-full relative z-20 ${showFAQ ? '' : 'shrink-0'}`}>
        {/* Header Section with Animation */}
        <div className="text-center mb-12 space-y-4">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm mb-4
            ${isDark ? 'bg-[#DDEF00]/10 border-[#DDEF00]/20' : 'bg-[#b5c800]/10 border-[#b5c800]/20'}"
          >
            <Sparkles className={`w-4 h-4 ${isDark ? 'text-[#DDEF00]' : 'text-[#b5c800]'}`} />
            <span className={`text-sm font-medium ${isDark ? 'text-[#DDEF00]' : 'text-[#b5c800]'}`}>
              24/7 Support Available
            </span>
          </div>

          <h1
            className={`
              text-5xl md:text-6xl font-bold mb-4 animate-fade-in
              bg-linear-to-r bg-clip-text text-transparent
              ${
                isDark
                  ? 'from-neutral-100 via-neutral-100 to-[#DDEF00]'
                  : 'from-neutral-900 via-neutral-900 to-[#b5c800]'
              }
            `}
          >
            Get in Touch
          </h1>
          <p
            className={`
              text-lg md:text-xl max-w-2xl mx-auto
              ${isDark ? 'text-neutral-400' : 'text-neutral-600'}
            `}
          >
            Have a question or need assistance? Our dedicated support team is here to help you
            succeed!
          </p>
        </div>

        {/* Stats/Features Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { icon: Clock, label: 'Fast Response', value: '< 24h', color: 'text-blue-500' },
            { icon: Shield, label: 'Secure', value: '100%', color: 'text-green-500' },
            {
              icon: MessageCircle,
              label: 'Support Tickets',
              value: '1000+',
              color: 'text-purple-500',
            },
            { icon: Zap, label: 'Resolution Rate', value: '98%', color: 'text-yellow-500' },
          ].map((stat, index) => (
            <div
              key={index}
              className={`
                p-4 rounded-xl border text-center transition-all duration-300
                hover:scale-105 hover:shadow-lg group cursor-pointer
                ${
                  isDark
                    ? 'bg-[rgba(15,15,15,0.65)] border-neutral-800 backdrop-blur-xl hover:border-[#DDEF00]/50'
                    : 'bg-white border-neutral-300 hover:border-[#b5c800]/50'
                }
              `}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <stat.icon
                className={`w-6 h-6 mx-auto mb-2 ${stat.color} group-hover:scale-110 transition-transform`}
              />
              <div
                className={`text-2xl font-bold mb-1 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
              >
                {stat.value}
              </div>
              <p className={`text-xs ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        {/* Contact Methods */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Email Support */}
          <button
            onClick={() => handleContactMethod('email')}
            className={`
              group relative p-6 rounded-2xl border transition-all duration-300
              hover:scale-105 hover:shadow-2xl cursor-pointer overflow-hidden
              ${
                isDark
                  ? 'bg-[rgba(15,15,15,0.85)] border-neutral-800 backdrop-blur-xl hover:border-[#DDEF00]/50'
                  : 'bg-white border-neutral-300 hover:border-[#b5c800]/50'
              }
            `}
          >
            <div className="absolute inset-0 bg-linear-to-br from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center bg-linear-to-br from-blue-500 to-cyan-500 group-hover:scale-110 transition-transform duration-300">
                <Mail className="w-7 h-7 text-white" />
              </div>
              <h3
                className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
              >
                Email Support
              </h3>
              <p
                className={`text-sm mb-4 text-center ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
              >
                fairarena.contact@gmail.com
              </p>
              <div
                className={`inline-flex items-center gap-2 text-sm font-medium ${isDark ? 'text-[#DDEF00]' : 'text-[#b5c800]'} group-hover:gap-3 transition-all duration-300`}
              >
                Send Email
                <span className="group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </div>
            </div>
          </button>

          {/* Live Chat */}
          <button
            onClick={() => handleContactMethod('chat')}
            className={`
              group relative p-6 rounded-2xl border transition-all duration-300
              hover:scale-105 hover:shadow-2xl cursor-pointer overflow-hidden
              ${
                isDark
                  ? 'bg-[rgba(15,15,15,0.85)] border-neutral-800 backdrop-blur-xl hover:border-[#DDEF00]/50'
                  : 'bg-white border-neutral-300 hover:border-[#b5c800]/50'
              }
            `}
          >
            <div className="absolute inset-0 bg-linear-to-br from-purple-500 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center bg-linear-to-br from-purple-500 to-pink-500 group-hover:scale-110 transition-transform duration-300">
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <h3
                className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
              >
                Live Chat
              </h3>
              <p
                className={`text-sm mb-4 text-center ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
              >
                Available 24/7
              </p>
              <div
                className={`inline-flex items-center gap-2 text-sm font-medium ${isDark ? 'text-[#DDEF00]' : 'text-[#b5c800]'} group-hover:gap-3 transition-all duration-300`}
              >
                Start Chat
                <span className="group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </div>
            </div>
          </button>

          {/* Help Center */}
          <button
            onClick={() => handleContactMethod('faq')}
            className={`
              group relative p-6 rounded-2xl border transition-all duration-300
              hover:scale-105 hover:shadow-2xl cursor-pointer overflow-hidden
              ${
                isDark
                  ? 'bg-[rgba(15,15,15,0.85)] border-neutral-800 backdrop-blur-xl hover:border-[#DDEF00]/50'
                  : 'bg-white border-neutral-300 hover:border-[#b5c800]/50'
              }
            `}
          >
            <div className="absolute inset-0 bg-linear-to-br from-orange-500 to-red-500 opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
            <div className="relative z-10 flex flex-col items-center justify-center">
              <div className="w-14 h-14 rounded-xl mb-4 flex items-center justify-center bg-linear-to-br from-orange-500 to-red-500 group-hover:scale-110 transition-transform duration-300">
                <HelpCircle className="w-7 h-7 text-white" />
              </div>
              <h3
                className={`text-xl font-bold mb-2 text-center ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
              >
                Help Center
              </h3>
              <p
                className={`text-sm mb-4 text-center ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
              >
                Browse our FAQ
              </p>
              <div
                className={`inline-flex items-center gap-2 text-sm font-medium ${isDark ? 'text-[#DDEF00]' : 'text-[#b5c800]'} group-hover:gap-3 transition-all duration-300`}
              >
                View FAQs
                <span className="group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </div>
            </div>
          </button>
        </div>

        {/* Main Form Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* FAQ Quick Links - Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <h3
              className={`text-lg font-semibold mb-4 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
            >
              Quick Help
            </h3>

            {quickHelpTopics.map((topic, index) => (
              <button
                key={index}
                onClick={() => handleQuickHelp(topic)}
                className={`
                  w-full text-left p-3 rounded-lg border transition-all duration-200
                  hover:scale-105 hover:shadow-lg
                  ${
                    isDark
                      ? 'bg-[rgba(15,15,15,0.65)] border-neutral-800 hover:border-[#DDEF00]/50 text-neutral-300 hover:text-[#DDEF00]'
                      : 'bg-white border-neutral-300 hover:border-[#b5c800]/50 text-neutral-700 hover:text-[#b5c800]'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span className="text-sm">{topic.question}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Support Form */}
          <div className="lg:col-span-2" ref={formRef}>
            <Card
              className={`
              border shadow-none
              ${
                isDark
                  ? 'bg-[rgba(15,15,15,0.95)] border-neutral-800'
                  : 'bg-white border-neutral-200'
              }
            `}
            >
              <CardHeader>
                <CardTitle className={isDark ? 'text-neutral-100' : 'text-neutral-900'}>
                  Send us a Message
                </CardTitle>
                <CardDescription className={isDark ? 'text-neutral-400' : 'text-neutral-600'}>
                  Fill out the form below and we'll get back to you as soon as possible.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form
                  className="pageclip-form space-y-5"
                  method="POST"
                  action={`https://send.pageclip.co/${import.meta.env.VITE_PAGECLIP_KEY}`}
                >
                  {/* Name Field */}
                  <div className="space-y-2">
                    <label
                      htmlFor="name"
                      className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
                    >
                      Full Name
                    </label>
                    <Input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={`
                        transition-all duration-200
                        ${
                          isDark
                            ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] placeholder:text-neutral-500'
                            : 'bg-white text-neutral-900 border-neutral-300 placeholder:text-neutral-400'
                        }
                        focus:border-[#DDEF00] focus-visible:ring-[#DDEF00]/20
                      `}
                    />
                  </div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
                    >
                      Email Address
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="john@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className={`
                        transition-all duration-200
                        ${
                          isDark
                            ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] placeholder:text-neutral-500'
                            : 'bg-white text-neutral-900 border-neutral-300 placeholder:text-neutral-400'
                        }
                        focus:border-[#DDEF00] focus-visible:ring-[#DDEF00]/20
                      `}
                    />
                  </div>

                  {/* Subject Field */}
                  <div className="space-y-2">
                    <label
                      htmlFor="subject"
                      className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
                    >
                      Subject
                    </label>
                    <Input
                      id="subject"
                      name="subject"
                      type="text"
                      placeholder="How can we help?"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className={`
                        transition-all duration-200
                        ${
                          isDark
                            ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] placeholder:text-neutral-500'
                            : 'bg-white text-neutral-900 border-neutral-300 placeholder:text-neutral-400'
                        }
                        focus:border-[#DDEF00] focus-visible:ring-[#DDEF00]/20
                      `}
                    />
                  </div>

                  {/* Message Field */}
                  <div className="space-y-2">
                    <label
                      htmlFor="message"
                      className={`text-sm font-medium ${isDark ? 'text-neutral-300' : 'text-neutral-700'}`}
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={6}
                      placeholder="Tell us more about your inquiry..."
                      value={formData.message}
                      onChange={handleChange}
                      required
                      className={`
                        w-full rounded-md border px-3 py-2 text-base
                        shadow-xs transition-all duration-200 outline-none resize-none
                        ${
                          isDark
                            ? 'bg-[#1A1A1A] text-neutral-100 border-[#2B2B2B] placeholder:text-neutral-500'
                            : 'bg-white text-neutral-900 border-neutral-300 placeholder:text-neutral-400'
                        }
                        focus:border-[#DDEF00] focus:ring-[3px] focus:ring-[#DDEF00]/20
                      `}
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    className={`
                      w-full h-11 bg-[#DDEF00] text-black font-semibold rounded-lg
                      hover:bg-[#c9d900] active:scale-95 transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed
                      flex items-center justify-center gap-2
                    `}
                  >
                    <>
                      <Send className="w-4 h-4" />
                      Send Message
                    </>
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* FAQ Section */}
        {showFAQ && (
          <div ref={faqRef} className="mt-16 space-y-6">
            <div className="text-center mb-8">
              <h2
                className={`text-3xl md:text-4xl font-bold mb-4 ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
              >
                Frequently Asked Questions
              </h2>
              <p className={`text-lg ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
                Find quick answers to common questions
              </p>
            </div>

            <div className="space-y-4 max-w-3xl mx-auto">
              {faqs.map((faq, index) => (
                <div
                  key={index}
                  className={`
                    rounded-xl border overflow-hidden transition-all duration-300
                    ${
                      isDark
                        ? 'bg-[rgba(15,15,15,0.65)] border-neutral-800 hover:border-[#DDEF00]/50'
                        : 'bg-white border-neutral-300 hover:border-[#b5c800]/50'
                    }
                  `}
                >
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4"
                  >
                    <span
                      className={`font-semibold ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
                    >
                      {faq.question}
                    </span>
                    {expandedFAQ === index ? (
                      <ChevronUp
                        className={`w-5 h-5 shrink-0 ${isDark ? 'text-[#DDEF00]' : 'text-[#b5c800]'}`}
                      />
                    ) : (
                      <ChevronDown
                        className={`w-5 h-5 shrink-0 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
                      />
                    )}
                  </button>

                  {expandedFAQ === index && (
                    <div
                      className={`px-5 pb-5 pt-0 ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}
                    >
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="text-center mt-8">
              <Button
                onClick={() => setShowFAQ(false)}
                variant="outline"
                className={`
                  ${
                    isDark
                      ? 'border-neutral-800 text-neutral-300 hover:bg-[rgba(15,15,15,0.65)] hover:text-[#DDEF00] hover:border-[#DDEF00]/50'
                      : 'border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:text-[#b5c800] hover:border-[#b5c800]/50'
                  }
                `}
              >
                Hide FAQs
              </Button>
            </div>
          </div>
        )}

        {/* Footer Note */}
        <p
          className={`
            text-center text-sm mt-6
            ${isDark ? 'text-neutral-500' : 'text-neutral-500'}`}
        >
          We typically respond within 24 hours during business days.
        </p>
      </div>
    </div>
  );
}
