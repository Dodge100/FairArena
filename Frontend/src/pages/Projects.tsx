import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    Archive,
    Award,
    CheckCircle2,
    Clock,
    ExternalLink,
    Eye,
    Folder,
    Github,
    Globe,
    Heart,
    MessageSquare,
    MoreVertical,
    Pause,
    Play,
    Plus,
    Search,
    Star,
    Tag,
    Trophy,
    Users,
    Zap
} from 'lucide-react';
import { useState } from 'react';
import { Spotlight } from '../components/ui/Spotlight';

// Types
interface Project {
    id: string;
    name: string;
    description: string;
    status: 'active' | 'completed' | 'archived' | 'paused';
    category: string;
    hackathon?: string;
    team: string[];
    technologies: string[];
    progress: number;
    createdAt: string;
    updatedAt: string;
    deadline?: string;
    githubUrl?: string;
    liveUrl?: string;
    stats: {
        views: number;
        likes: number;
        comments: number;
        stars: number;
    };
    prize?: string;
    rank?: number;
}

// Mock data
const MOCK_PROJECTS: Project[] = [
    {
        id: '1',
        name: 'AI-Powered Code Review Assistant',
        description: 'An intelligent code review tool that uses machine learning to detect bugs, suggest improvements, and enforce coding standards automatically.',
        status: 'active',
        category: 'AI/ML',
        hackathon: 'Global Tech Hackathon 2025',
        team: ['You', 'Sarah Chen', 'Mike Johnson', 'Priya Patel'],
        technologies: ['Python', 'TensorFlow', 'React', 'Node.js', 'Docker'],
        progress: 75,
        createdAt: '2024-11-15',
        updatedAt: '2024-12-10',
        deadline: '2024-12-20',
        githubUrl: 'https://github.com/username/ai-code-review',
        liveUrl: 'https://ai-code-review.demo.com',
        stats: { views: 456, likes: 89, comments: 34, stars: 67 }
    },
    {
        id: '2',
        name: 'Blockchain Voting System',
        description: 'Secure, transparent, and tamper-proof voting system built on blockchain technology for democratic elections.',
        status: 'completed',
        category: 'Blockchain',
        hackathon: 'Web3 Innovation Challenge',
        team: ['You', 'Alex Kumar', 'Emma Wilson'],
        technologies: ['Solidity', 'Ethereum', 'React', 'Web3.js', 'IPFS'],
        progress: 100,
        createdAt: '2024-09-01',
        updatedAt: '2024-10-15',
        deadline: '2024-10-15',
        githubUrl: 'https://github.com/username/blockchain-voting',
        liveUrl: 'https://blockchain-vote.demo.com',
        stats: { views: 892, likes: 156, comments: 67, stars: 123 },
        prize: '$5,000',
        rank: 1
    },
    {
        id: '3',
        name: 'Smart Home Dashboard',
        description: 'Unified IoT dashboard for managing and monitoring all smart home devices with real-time analytics and automation.',
        status: 'active',
        category: 'IoT',
        hackathon: 'Smart City Hackathon',
        team: ['You', 'David Lee', 'Sophie Martin', 'Raj Sharma', 'Lisa Anderson'],
        technologies: ['React', 'Node.js', 'MQTT', 'MongoDB', 'Arduino'],
        progress: 45,
        createdAt: '2024-12-01',
        updatedAt: '2024-12-15',
        deadline: '2025-01-10',
        githubUrl: 'https://github.com/username/smart-home',
        stats: { views: 234, likes: 45, comments: 12, stars: 34 }
    },
    {
        id: '4',
        name: 'Eco Tracker Mobile App',
        description: 'Track your carbon footprint, get personalized sustainability tips, and compete with friends to reduce environmental impact.',
        status: 'completed',
        category: 'Mobile',
        hackathon: 'Green Tech Challenge',
        team: ['You', 'Nina Patel'],
        technologies: ['React Native', 'Firebase', 'Node.js', 'PostgreSQL'],
        progress: 100,
        createdAt: '2024-07-10',
        updatedAt: '2024-08-20',
        deadline: '2024-08-20',
        githubUrl: 'https://github.com/username/eco-tracker',
        liveUrl: 'https://eco-tracker.app',
        stats: { views: 567, likes: 98, comments: 45, stars: 87 },
        prize: '$2,500',
        rank: 3
    },
    {
        id: '5',
        name: 'Real-time Collaboration Whiteboard',
        description: 'Multiplayer whiteboard with real-time sync, voice chat, and AI-powered shape recognition for remote teams.',
        status: 'paused',
        category: 'Web Development',
        team: ['You', 'Tom Brown'],
        technologies: ['Next.js', 'Socket.io', 'Canvas API', 'WebRTC'],
        progress: 60,
        createdAt: '2024-10-05',
        updatedAt: '2024-11-20',
        githubUrl: 'https://github.com/username/collab-whiteboard',
        stats: { views: 178, likes: 32, comments: 8, stars: 23 }
    },
    {
        id: '6',
        name: 'Healthcare Appointment System',
        description: 'Streamlined patient-doctor appointment booking with telemedicine integration and automated reminders.',
        status: 'archived',
        category: 'Healthcare',
        hackathon: 'HealthTech Summit 2024',
        team: ['You', 'Dr. James Wilson', 'Maria Garcia'],
        technologies: ['Vue.js', 'Express', 'MySQL', 'Twilio'],
        progress: 85,
        createdAt: '2024-05-15',
        updatedAt: '2024-06-30',
        deadline: '2024-06-30',
        githubUrl: 'https://github.com/username/healthcare-appointments',
        stats: { views: 345, likes: 56, comments: 23, stars: 45 }
    }
];

const CATEGORIES = ['All', 'AI/ML', 'Blockchain', 'IoT', 'Mobile', 'Web Development', 'Healthcare'];
const STATUSES = ['All', 'Active', 'Completed', 'Paused', 'Archived'];

const StatusBadge = ({ status }: { status: Project['status'] }) => {
    const variants = {
        active: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
        completed: 'bg-green-500/10 text-green-600 border-green-200 dark:border-green-800',
        paused: 'bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800',
        archived: 'bg-gray-500/10 text-gray-600 border-gray-200 dark:border-gray-800'
    };

    const icons = {
        active: Play,
        completed: CheckCircle2,
        paused: Pause,
        archived: Archive
    };

    const Icon = icons[status];

    return (
        <Badge variant="outline" className={cn('gap-1', variants[status])}>
            <Icon className="w-3 h-3" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
    );
};

const ProjectCard = ({ project }: { project: Project }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -4 }}
        >
            <Card className="h-full hover:shadow-xl transition-all duration-300 border-l-4 border-l-primary group cursor-pointer">
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <Folder className="w-5 h-5 text-primary" />
                                <CardTitle className="text-xl group-hover:text-primary transition-colors">
                                    {project.name}
                                </CardTitle>
                            </div>
                            <CardDescription className="line-clamp-2">
                                {project.description}
                            </CardDescription>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="w-4 h-4" />
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="space-y-4">
                    {/* Status and Category */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={project.status} />
                        <Badge variant="secondary" className="gap-1">
                            <Tag className="w-3 h-3" />
                            {project.category}
                        </Badge>
                        {project.hackathon && (
                            <Badge variant="outline" className="gap-1">
                                <Trophy className="w-3 h-3" />
                                {project.hackathon}
                            </Badge>
                        )}
                    </div>

                    {/* Technologies */}
                    <div className="flex flex-wrap gap-1.5">
                        {project.technologies.slice(0, 4).map((tech, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                                {tech}
                            </Badge>
                        ))}
                        {project.technologies.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                                +{project.technologies.length - 4}
                            </Badge>
                        )}
                    </div>

                    {/* Progress */}
                    {project.status === 'active' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Progress</span>
                                <span className="font-semibold">{project.progress}%</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${project.progress}%` }}
                                    transition={{ duration: 1, ease: "easeOut" }}
                                    className="h-full bg-primary rounded-full"
                                />
                            </div>
                        </div>
                    )}

                    {/* Team */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span>{project.team.length} members</span>
                        {project.deadline && (
                            <>
                                <Separator orientation="vertical" className="h-4" />
                                <Clock className="w-4 h-4" />
                                <span>Due {new Date(project.deadline).toLocaleDateString()}</span>
                            </>
                        )}
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                        <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {project.stats.views}
                        </span>
                        <span className="flex items-center gap-1">
                            <Heart className="w-4 h-4" />
                            {project.stats.likes}
                        </span>
                        <span className="flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {project.stats.comments}
                        </span>
                        <span className="flex items-center gap-1">
                            <Star className="w-4 h-4" />
                            {project.stats.stars}
                        </span>
                    </div>

                    {/* Prize/Rank */}
                    {project.prize && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
                            <Award className="w-5 h-5 text-yellow-600" />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-500">
                                    {project.rank && `#${project.rank} - `}{project.prize}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="flex gap-2">
                    {project.githubUrl && (
                        <Button variant="outline" size="sm" className="gap-2 flex-1" asChild>
                            <a href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                                <Github className="w-4 h-4" />
                                Code
                            </a>
                        </Button>
                    )}
                    {project.liveUrl && (
                        <Button variant="outline" size="sm" className="gap-2 flex-1" asChild>
                            <a href={project.liveUrl} target="_blank" rel="noopener noreferrer">
                                <Globe className="w-4 h-4" />
                                Live
                            </a>
                        </Button>
                    )}
                    <Button size="sm" className="gap-2 flex-1">
                        <ExternalLink className="w-4 h-4" />
                        View
                    </Button>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

export default function ProjectsPage() {
    const { isDark } = useTheme();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedStatus, setSelectedStatus] = useState('All');
    const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);

    // Filter projects
    const filteredProjects = MOCK_PROJECTS.filter(project => {
        const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || project.category === selectedCategory;
        const matchesStatus = selectedStatus === 'All' || project.status === selectedStatus.toLowerCase();

        return matchesSearch && matchesCategory && matchesStatus;
    });

    // Stats
    const stats = {
        total: MOCK_PROJECTS.length,
        active: MOCK_PROJECTS.filter(p => p.status === 'active').length,
        completed: MOCK_PROJECTS.filter(p => p.status === 'completed').length,
        totalPrizes: MOCK_PROJECTS.reduce((sum, p) => sum + (p.prize ? parseInt(p.prize.replace(/[^0-9]/g, '')) : 0), 0)
    };

    return (
        <div className={cn(
            "min-h-screen w-full bg-background relative overflow-x-hidden pb-12 px-4 md:px-8",
            "pt-4 md:pt-8"
        )}>
            <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill={isDark ? '#DDFF00' : '#b5c800'} />

            {/* Header */}
            <div className="w-full max-w-7xl mx-auto z-10 mb-10 space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                            My <span className="text-primary">Projects</span>
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Manage and showcase your hackathon submissions
                        </p>
                    </div>
                    <Button className="gap-2" onClick={() => setIsNewProjectDialogOpen(true)}>
                        <Plus className="w-4 h-4" />
                        New Project
                    </Button>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Projects</p>
                                    <p className="text-2xl font-bold">{stats.total}</p>
                                </div>
                                <Folder className="w-8 h-8 text-blue-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Active</p>
                                    <p className="text-2xl font-bold">{stats.active}</p>
                                </div>
                                <Zap className="w-8 h-8 text-yellow-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Completed</p>
                                    <p className="text-2xl font-bold">{stats.completed}</p>
                                </div>
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Prizes</p>
                                    <p className="text-2xl font-bold">${stats.totalPrizes.toLocaleString()}</p>
                                </div>
                                <Trophy className="w-8 h-8 text-primary" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            {/* Search */}
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search projects..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {/* Category Filter */}
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map((category) => (
                                        <SelectItem key={category} value={category}>
                                            {category}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Status Filter */}
                            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                                <SelectTrigger className="w-full md:w-[180px]">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map((status) => (
                                        <SelectItem key={status} value={status}>
                                            {status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Projects Grid */}
            <div className="w-full max-w-7xl mx-auto z-10">
                {filteredProjects.length === 0 ? (
                    <Card className="p-12">
                        <div className="text-center space-y-4">
                            <Folder className="w-16 h-16 mx-auto text-muted-foreground/30" />
                            <div>
                                <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                                <p className="text-muted-foreground">
                                    {searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All'
                                        ? 'Try adjusting your filters'
                                        : 'Get started by creating your first project'}
                                </p>
                            </div>
                            {!searchQuery && selectedCategory === 'All' && selectedStatus === 'All' && (
                                <Button className="gap-2" onClick={() => setIsNewProjectDialogOpen(true)}>
                                    <Plus className="w-4 h-4" />
                                    Create Project
                                </Button>
                            )}
                        </div>
                    </Card>
                ) : (
                    <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {filteredProjects.map((project) => (
                            <ProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>

            {/* New Project Dialog */}
            <Dialog open={isNewProjectDialogOpen} onOpenChange={setIsNewProjectDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                            Add a new project to your portfolio. You can edit these details later.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="project-name">Project Name</Label>
                            <Input id="project-name" placeholder="My Awesome Project" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="project-description">Description</Label>
                            <Textarea
                                id="project-description"
                                placeholder="Describe your project..."
                                className="min-h-[100px]"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="project-category">Category</Label>
                                <Select>
                                    <SelectTrigger id="project-category">
                                        <SelectValue placeholder="Select category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {CATEGORIES.filter(c => c !== 'All').map((category) => (
                                            <SelectItem key={category} value={category}>
                                                {category}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="project-hackathon">Hackathon (Optional)</Label>
                                <Input id="project-hackathon" placeholder="Hackathon name" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="project-github">GitHub URL (Optional)</Label>
                                <Input id="project-github" placeholder="https://github.com/..." />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="project-live">Live URL (Optional)</Label>
                                <Input id="project-live" placeholder="https://..." />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="project-technologies">Technologies (comma-separated)</Label>
                            <Input id="project-technologies" placeholder="React, Node.js, MongoDB" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewProjectDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={() => setIsNewProjectDialogOpen(false)}>
                            Create Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
