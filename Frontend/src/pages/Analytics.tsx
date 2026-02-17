import { ComingSoonModal } from '@/components/ComingSoonModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Award,
  BarChart3,
  Calendar,
  Clock,
  Code,
  Download,
  Eye,
  Filter,
  GitBranch,
  Heart,
  LineChart,
  Medal,
  MessageSquare,
  PieChart,
  Share2,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Spotlight } from '../components/ui/Spotlight';

// Mock data - Replace with actual API calls
const MOCK_ANALYTICS = {
  overview: {
    totalSubmissions: 24,
    totalHackathons: 8,
    winRate: 37.5,
    totalPrizes: 15000,
    profileViews: 1247,
    teamCollaborations: 12,
    avgRating: 4.6,
    totalStars: 89,
  },
  performance: {
    monthlySubmissions: [3, 5, 4, 6, 8, 7, 9, 8],
    winsByCategory: {
      'AI/ML': 2,
      'Web Development': 1,
      Blockchain: 0,
      'Mobile Apps': 0,
      IoT: 0,
    },
    skillProgress: [
      { skill: 'React', level: 85, growth: 12 },
      { skill: 'Node.js', level: 78, growth: 8 },
      { skill: 'Python', level: 72, growth: 15 },
      { skill: 'TypeScript', level: 90, growth: 5 },
      { skill: 'Docker', level: 65, growth: 20 },
    ],
  },
  engagement: {
    totalLikes: 342,
    totalComments: 156,
    totalShares: 89,
    followerGrowth: [120, 135, 148, 162, 178, 195, 214, 234],
    topProjects: [
      { name: 'AI Code Assistant', views: 456, likes: 89, comments: 34 },
      { name: 'Smart Parking System', views: 389, likes: 67, comments: 28 },
      { name: 'Eco Tracker App', views: 312, likes: 54, comments: 19 },
    ],
  },
  achievements: [
    {
      title: 'First Win',
      description: 'Won your first hackathon',
      date: '2024-03-15',
      icon: Trophy,
    },
    {
      title: 'Team Player',
      description: 'Collaborated with 10+ teams',
      date: '2024-06-20',
      icon: Users,
    },
    { title: 'Code Master', description: 'Submitted 20+ projects', date: '2024-09-10', icon: Code },
    {
      title: 'Rising Star',
      description: 'Reached 1000 profile views',
      date: '2024-11-05',
      icon: Star,
    },
  ],
  recentActivity: [
    {
      type: 'submission',
      project: 'AI-Powered Code Review',
      hackathon: 'Global Tech Hackathon',
      date: '2 days ago',
      status: 'pending',
    },
    {
      type: 'win',
      project: 'Blockchain Voting System',
      hackathon: 'Web3 Challenge',
      date: '1 week ago',
      status: 'won',
      prize: '$5,000',
    },
    {
      type: 'collaboration',
      project: 'Smart Home Dashboard',
      team: 'Tech Innovators',
      date: '2 weeks ago',
      status: 'active',
    },
  ],
};

const StatCard = ({ title, value, change, icon: Icon, trend, color }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <Card
      className="hover:shadow-lg transition-all duration-300 border-l-4"
      style={{ borderLeftColor: color }}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="flex items-center gap-1 text-xs">
                {trend === 'up' ? (
                  <ArrowUp className="w-3 h-3 text-green-500" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-red-500" />
                )}
                <span className={cn(trend === 'up' ? 'text-green-600' : 'text-red-600')}>
                  {change}
                </span>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            )}
          </div>
          <div
            className={cn('p-3 rounded-full bg-opacity-10')}
            style={{ backgroundColor: `${color}20` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

const ProgressBar = ({ label, value, color, growth }: any) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{value}%</span>
        {growth && (
          <Badge variant="outline" className="text-xs gap-1">
            <TrendingUp className="w-3 h-3" />+{growth}%
          </Badge>
        )}
      </div>
    </div>
    <div className="h-2 bg-secondary rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 1, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  </div>
);

export default function AnalyticsPage() {
  const { isDark } = useTheme();
  const [timeRange, setTimeRange] = useState('30d');
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  const [comingSoonFeature, setComingSoonFeature] = useState('');

  const showComingSoon = (feature: string) => {
    setComingSoonFeature(feature);
    setComingSoonOpen(true);
  };

  const stats = [
    {
      title: 'Total Submissions',
      value: MOCK_ANALYTICS.overview.totalSubmissions,
      change: '+12%',
      trend: 'up',
      icon: Target,
      color: '#3b82f6',
    },
    {
      title: 'Win Rate',
      value: `${MOCK_ANALYTICS.overview.winRate}%`,
      change: '+5%',
      trend: 'up',
      icon: Trophy,
      color: '#f59e0b',
    },
    {
      title: 'Profile Views',
      value: MOCK_ANALYTICS.overview.profileViews.toLocaleString(),
      change: '+23%',
      trend: 'up',
      icon: Eye,
      color: '#8b5cf6',
    },
    {
      title: 'Total Prizes',
      value: `$${MOCK_ANALYTICS.overview.totalPrizes.toLocaleString()}`,
      change: '+$3,000',
      trend: 'up',
      icon: Award,
      color: '#10b981',
    },
  ];

  return (
    <div
      className={cn(
        'min-h-screen w-full bg-background relative overflow-x-hidden pb-12 px-4 md:px-8',
        'pt-4 md:pt-8',
      )}
    >
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill={isDark ? '#DDFF00' : '#b5c800'}
      />

      {/* Header */}
      <div className="w-full max-w-7xl mx-auto z-10 mb-10 space-y-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
              Analytics <span className="text-primary">Dashboard</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Track your performance, growth, and achievements
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => showComingSoon('Filter Analytics')}
            >
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => showComingSoon('Export Data')}
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex items-center gap-2">
          {['7d', '30d', '90d', '1y', 'all'].map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTimeRange(range);
                showComingSoon(`Time Range: ${range === 'all' ? 'All Time' : range.toUpperCase()}`);
              }}
              className="text-xs"
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="w-full max-w-7xl mx-auto z-10 mb-8">
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto z-10">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid h-auto p-1">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="engagement" className="gap-2">
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Engagement</span>
            </TabsTrigger>
            <TabsTrigger value="achievements" className="gap-2">
              <Medal className="w-4 h-4" />
              <span className="hidden sm:inline">Achievements</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Recent Activity */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>Your latest hackathon activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {MOCK_ANALYTICS.recentActivity.map((activity, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
                          onClick={() => showComingSoon(`Activity: ${activity.project}`)}
                        >
                          <div
                            className={cn(
                              'p-2 rounded-full shrink-0',
                              activity.type === 'win'
                                ? 'bg-yellow-500/10 text-yellow-600'
                                : activity.type === 'submission'
                                  ? 'bg-blue-500/10 text-blue-600'
                                  : 'bg-purple-500/10 text-purple-600',
                            )}
                          >
                            {activity.type === 'win' ? (
                              <Trophy className="w-4 h-4" />
                            ) : activity.type === 'submission' ? (
                              <Target className="w-4 h-4" />
                            ) : (
                              <Users className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <p className="font-semibold text-sm">{activity.project}</p>
                            <p className="text-xs text-muted-foreground">
                              {activity.hackathon || activity.team}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {activity.status}
                              </Badge>
                              {activity.prize && (
                                <span className="text-xs font-semibold text-green-600">
                                  {activity.prize}
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground ml-auto">
                                {activity.date}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Quick Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Hackathons Joined</span>
                      </div>
                      <span className="font-bold">{MOCK_ANALYTICS.overview.totalHackathons}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Team Collaborations</span>
                      </div>
                      <span className="font-bold">
                        {MOCK_ANALYTICS.overview.teamCollaborations}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Average Rating</span>
                      </div>
                      <span className="font-bold">{MOCK_ANALYTICS.overview.avgRating}/5.0</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Heart className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Total Stars</span>
                      </div>
                      <span className="font-bold">{MOCK_ANALYTICS.overview.totalStars}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Wins by Category</h4>
                    {Object.entries(MOCK_ANALYTICS.performance.winsByCategory).map(
                      ([category, wins]) => (
                        <div key={category} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{category}</span>
                          <Badge variant={wins > 0 ? 'default' : 'secondary'}>{wins}</Badge>
                        </div>
                      ),
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Skill Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Skill Progress
                  </CardTitle>
                  <CardDescription>Your technical skill development</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {MOCK_ANALYTICS.performance.skillProgress.map((skill, index) => (
                    <ProgressBar
                      key={index}
                      label={skill.skill}
                      value={skill.level}
                      growth={skill.growth}
                      color={`hsl(${index * 60}, 70%, 50%)`}
                    />
                  ))}
                </CardContent>
              </Card>

              {/* Monthly Submissions Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5" />
                    Monthly Submissions
                  </CardTitle>
                  <CardDescription>Submission trend over the last 8 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-end justify-between gap-2">
                    {MOCK_ANALYTICS.performance.monthlySubmissions.map((count, index) => (
                      <motion.div
                        key={index}
                        initial={{ height: 0 }}
                        animate={{ height: `${(count / 10) * 100}%` }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        className="flex-1 bg-primary rounded-t-md relative group cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ minHeight: '20px' }}
                        onClick={() => showComingSoon('Submission Details')}
                      >
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Badge>{count}</Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-4 text-xs text-muted-foreground">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((month) => (
                      <span key={month}>{month}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Engagement Tab */}
          <TabsContent value="engagement" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Engagement Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Engagement Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                    <div className="flex items-center gap-3">
                      <Heart className="w-5 h-5 text-red-500" />
                      <span className="font-medium">Total Likes</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {MOCK_ANALYTICS.engagement.totalLikes}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                    <div className="flex items-center gap-3">
                      <MessageSquare className="w-5 h-5 text-blue-500" />
                      <span className="font-medium">Total Comments</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {MOCK_ANALYTICS.engagement.totalComments}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                    <div className="flex items-center gap-3">
                      <Share2 className="w-5 h-5 text-green-500" />
                      <span className="font-medium">Total Shares</span>
                    </div>
                    <span className="text-2xl font-bold">
                      {MOCK_ANALYTICS.engagement.totalShares}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Top Projects */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5" />
                    Top Performing Projects
                  </CardTitle>
                  <CardDescription>Your most popular submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {MOCK_ANALYTICS.engagement.topProjects.map((project, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-4 p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                          #{index + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{project.name}</h4>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {project.views}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" /> {project.likes}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" /> {project.comments}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Achievements Tab */}
          <TabsContent value="achievements" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="w-5 h-5" />
                  Your Achievements
                </CardTitle>
                <CardDescription>Milestones and accomplishments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {MOCK_ANALYTICS.achievements.map((achievement, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="p-6 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => showComingSoon(`Achievement: ${achievement.title}`)}
                    >
                      <div className="flex flex-col items-center text-center space-y-3">
                        <div className="p-3 rounded-full bg-primary/20">
                          <achievement.icon className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-bold">{achievement.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {achievement.description}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">{achievement.date}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <ComingSoonModal
        open={comingSoonOpen}
        onOpenChange={setComingSoonOpen}
        feature={comingSoonFeature}
      />
    </div>
  );
}
