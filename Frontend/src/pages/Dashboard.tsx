import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@clerk/clerk-react';
import {
  Activity,
  ArrowUpRight,
  Award,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

function Dashboard() {
  const { user } = useUser();
  const stats = [
    {
      title: 'Active Projects',
      value: '12',
      change: '+2 this week',
      trend: 'up',
      icon: Trophy,
      color: 'text-blue-500',
    },
    {
      title: 'Team Members',
      value: '48',
      change: '+8 this month',
      trend: 'up',
      icon: Users,
      color: 'text-green-500',
    },
    {
      title: 'Hackathons Won',
      value: '7',
      change: '3 this quarter',
      trend: 'up',
      icon: Award,
      color: 'text-yellow-500',
    },
    {
      title: 'Success Rate',
      value: '94%',
      change: '+5% from last month',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-purple-500',
    },
  ];

  const recentProjects = [
    {
      name: 'AI-Powered Code Review',
      status: 'In Progress',
      deadline: '2 days left',
      team: 5,
      progress: 75,
    },
    {
      name: 'Blockchain Voting System',
      status: 'Review',
      deadline: '5 days left',
      team: 4,
      progress: 90,
    },
    {
      name: 'Smart Home Dashboard',
      status: 'Planning',
      deadline: '10 days left',
      team: 6,
      progress: 30,
    },
  ];

  const upcomingEvents = [
    {
      name: 'Global Tech Hackathon 2025',
      date: 'Dec 1-3, 2025',
      type: 'Virtual',
      prize: '$50,000',
    },
    {
      name: 'AI Innovation Challenge',
      date: 'Dec 15-17, 2025',
      type: 'Hybrid',
      prize: '$30,000',
    },
    {
      name: 'Web3 Build Weekend',
      date: 'Jan 5-7, 2026',
      type: 'In-Person',
      prize: '$25,000',
    },
  ];



  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user?.firstName}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your projects today.
          </p>
        </div>
        <Button className="bg-linear-to-r from-[#DDFF00] to-[#9AC400] text-neutral-900 hover:opacity-90">
          <Zap className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        {/* Recent Projects */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Projects</CardTitle>
                <CardDescription>Your active hackathon submissions</CardDescription>
              </div>
              <Button variant="ghost" size="sm">
                View All
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProjects.map((project, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{project.name}</h4>
                      <Badge
                        variant={project.status === 'In Progress' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {project.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {project.deadline}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {project.team} members
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div
                          className="bg-linear-to-r from-[#DDFF00] to-[#9AC400] h-2 rounded-full transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-1">
                        {project.progress}% complete
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Hackathons</CardTitle>
            <CardDescription>Don't miss these opportunities</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingEvents.map((event, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer space-y-2"
                >
                  <h4 className="font-semibold text-sm">{event.name}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {event.date}
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {event.type}
                    </Badge>
                    <span className="text-xs font-semibold text-green-600">{event.prize}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Target className="h-6 w-6" />
              <span className="text-sm">Submit Project</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">Invite Team</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Activity className="h-6 w-6" />
              <span className="text-sm">View Analytics</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2">
              <Calendar className="h-6 w-6" />
              <span className="text-sm">Schedule Meet</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Dashboard;
