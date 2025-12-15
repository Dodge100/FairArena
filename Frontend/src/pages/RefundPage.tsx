import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, XCircle } from 'lucide-react';

const RefundPage = () => {
    return (
        <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
            <div className="container mx-auto px-4 py-25 max-w-4xl">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 dark:bg-red-900/50 rounded-full mb-6">
                        <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-4xl font-bold bg-linear-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent mb-4">
                        Refund Policy
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        FairArena generally does not offer refunds for digital services. Please read this policy carefully before making any purchases.
                    </p>
                </div>

                {/* Main Policy Statement */}
                <Card className="mb-8 border-0 shadow-xl bg-linear-to-r from-slate-50 to-blue-50 dark:from-slate-950/50 dark:to-blue-950/50 border-slate-200 dark:border-slate-800">
                    <CardContent className="p-8 text-center">
                        <div className="h-16 w-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
                            <span className="text-2xl font-bold text-slate-600 dark:text-slate-400">§</span>
                        </div>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                            Refund Policy
                        </h2>
                        <p className="text-xl text-slate-700 dark:text-slate-300 mb-6 max-w-3xl mx-auto leading-relaxed">
                            FairArena reserves the right to deny refund requests at its sole discretion. Refunds are not guaranteed and may be declined for any reason.
                        </p>
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                            <p className="text-lg font-semibold text-slate-900 dark:text-white mb-3">
                                Terms of Service Agreement
                            </p>
                            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                By purchasing credits or services from FairArena, you expressly acknowledge and agree that all sales are final.
                                FairArena reserves the absolute right to determine, in its sole discretion, whether any refund request will be honored.
                                This determination is final and not subject to appeal.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Refund Determination Criteria */}
                <Card className="mb-8 border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-3">
                            <span className="text-slate-600 dark:text-slate-400 font-bold">⚖️</span>
                            Refund Determination Criteria
                        </CardTitle>
                        <CardDescription>
                            FairArena evaluates refund requests based on the following criteria, though approval is not guaranteed
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-3 text-lg">
                                FairArena's Discretionary Review Process
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                                Each refund request is subject to individual review by FairArena. The company reserves the right to deny any refund request,
                                including but not limited to requests based on the following circumstances:
                            </p>
                            <div className="grid md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Account suspension or termination</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Violation of Terms of Service</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Change of mind or buyer's remorse</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Technical difficulties or service issues</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Credits already consumed or utilized</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Duplicate or accidental payments</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Third-party service complications</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Extended time periods since purchase</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-red-500 mt-1">•</span>
                                        <span className="text-slate-600 dark:text-slate-400">Any other reason at FairArena's discretion</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950/50 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                            <h3 className="font-bold text-blue-900 dark:text-blue-100 mb-3">
                                Limited Circumstances for Consideration
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                                In extremely rare cases, FairArena may consider refund requests only under the following circumstances,
                                subject to the company's sole discretion and final determination:
                            </p>
                            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>Complete and prolonged platform unavailability exceeding thirty (30) consecutive days</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>Critical security compromise directly affecting payment processing systems</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-blue-500 mt-1">•</span>
                                    <span>Legal mandate requiring refund processing</span>
                                </li>
                            </ul>
                            <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 italic font-medium">
                                Even in these limited circumstances, FairArena reserves the right to deny the refund request.
                                All determinations are final and not subject to further review or appeal.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Refund Request Submission */}
                <Card className="mb-8 border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-3">
                            <span className="text-slate-600 dark:text-slate-400 font-bold">📋</span>
                            Refund Request Submission
                        </CardTitle>
                        <CardDescription>
                            Formal process for submitting refund requests, subject to FairArena's review and approval
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="bg-slate-50 dark:bg-slate-950/50 p-6 rounded-lg border border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white mb-4 text-lg">
                                Submission Requirements
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 mb-4 leading-relaxed">
                                Refund requests must be submitted in writing via email to the designated support address.
                                All requests are subject to review and FairArena reserves the right to request additional information or documentation.
                            </p>
                            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                <div className="flex items-start gap-3">
                                    <span className="text-slate-500 mt-1">•</span>
                                    <span>Complete order identification information</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-slate-500 mt-1">•</span>
                                    <span>Detailed explanation of the circumstances</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-slate-500 mt-1">•</span>
                                    <span>Supporting documentation where applicable</span>
                                </div>
                                <div className="flex items-start gap-3">
                                    <span className="text-slate-500 mt-1">•</span>
                                    <span>Account verification details</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-950/50 p-6 rounded-lg border border-amber-200 dark:border-amber-800">
                            <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-3">
                                ⚠️ Important Notice Regarding Processing
                            </h3>
                            <p className="text-slate-700 dark:text-slate-300 mb-3 leading-relaxed">
                                Submission of a refund request does not guarantee approval or processing. FairArena reserves the absolute right to:
                            </p>
                            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-1">•</span>
                                    <span>Deny any refund request without providing specific reasons</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-1">•</span>
                                    <span>Request additional information or documentation</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-1">•</span>
                                    <span>Modify refund amounts at its sole discretion</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-amber-500 mt-1">•</span>
                                    <span>Determine processing timelines independently</span>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Legal Terms and Conditions */}
                <Card className="mb-8 border-0 shadow-xl">
                    <CardHeader>
                        <CardTitle className="text-2xl flex items-center gap-3">
                            <span className="text-slate-600 dark:text-slate-400 font-bold">⚖️</span>
                            Legal Terms and Conditions
                        </CardTitle>
                        <CardDescription>
                            Binding legal framework governing refund requests and determinations
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                        <div className="grid md:grid-cols-1 gap-4">
                            <div className="space-y-3">
                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <p className="font-medium text-slate-900 dark:text-white mb-2">Final Authority</p>
                                    <p>FairArena maintains exclusive authority in determining the validity and approval of all refund requests. This authority is not delegable and all determinations are final.</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <p className="font-medium text-slate-900 dark:text-white mb-2">No Guarantee of Approval</p>
                                    <p>The submission of a refund request does not constitute or imply any guarantee of approval, partial approval, or processing of said request.</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <p className="font-medium text-slate-900 dark:text-white mb-2">Processing Discretion</p>
                                    <p>FairArena reserves the right to determine processing methods, timelines, and amounts for approved refunds at its sole discretion.</p>
                                </div>
                                <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800">
                                    <p className="font-medium text-slate-900 dark:text-white mb-2">Policy Modification</p>
                                    <p>This refund policy may be modified by FairArena at any time without prior notice. Modified terms apply to all subsequent purchases.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Contact and Communication */}
                <Card className="bg-linear-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950/50 border-slate-200 dark:border-slate-700">
                    <CardContent className="p-8 text-center">
                        <div className="h-12 w-12 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-slate-600 dark:text-slate-400 font-bold text-lg">@</span>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            Refund Request Submission
                        </h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-2xl mx-auto leading-relaxed">
                            Refund requests may be submitted via the designated communication channel. FairArena reserves the right to determine response protocols and communication methods.
                        </p>
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 mb-6">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <strong>Communication Policy:</strong> FairArena may or may not respond to refund requests. All communications are conducted at the company's discretion and do not constitute approval or acknowledgment of any refund entitlement.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4">
                            <Button
                                onClick={() => window.open('mailto:fairarena.contact@gmail.com?subject=Refund Request Inquiry', '_blank')}
                                variant="outline"
                                size="lg"
                                className="border-slate-500 text-slate-600 hover:bg-slate-50 dark:border-slate-400 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                <Mail className="h-4 w-4 mr-2" />
                                Submit Inquiry
                            </Button>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-4">
                            FairArena is not obligated to respond to refund requests or provide status updates.
                        </p>
                    </CardContent>
                </Card>

                {/* Policy Effective Date and Governing Law */}
                <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
                    <div className="text-center text-sm text-slate-600 dark:text-slate-400 space-y-2">
                        <p className="font-medium">Refund Policy - Effective December 2025</p>
                        <p>This policy governs all transactions occurring on or after December 1, 2025.</p>
                        <p className="text-xs">FairArena reserves the right to modify this policy at any time without notice.</p>
                        <p className="text-xs mt-4 italic">All refund determinations are made at FairArena's sole discretion and are final.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RefundPage;
