import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, Mail, Lock, UserPlus, User } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [isSignUp, setIsSignUp] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const from = location.state?.from?.pathname || '/';

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) {
            toast.error('Please enter your email address');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            });
            if (error) throw error;
            toast.success('Password reset link sent! Please check your email.');
            setIsForgotPassword(false);
        } catch (err: any) {
            toast.error(err.message || 'Failed to send reset link.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isForgotPassword) {
            handleResetRequest(e);
            return;
        }

        if (!email || !password || (isSignUp && !fullName)) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsLoading(true);

        try {
            if (isSignUp) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                        }
                    }
                });
                if (error) throw error;
                toast.success('Account created! Please check your email for verification.');
                setIsSignUp(false);
            } else {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
                toast.success('Successfully logged in');
                navigate(from, { replace: true });
            }
        } catch (err: any) {
            toast.error(err.message || 'Authentication failed. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-app-gradient flex items-center justify-center p-4 relative overflow-hidden">
            {/* Premium Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse delay-700 pointer-events-none" />
            <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out fill-mode-both">
                {/* Logo/Header */}
                <div className="text-center mb-10 space-y-3">
                    <div className="mx-auto w-20 h-20 rounded-[2.5rem] bg-sidebar-primary shadow-[0_20px_50px_rgba(var(--sidebar-primary),0.3)] flex items-center justify-center mb-6 border border-white/20 transform hover:rotate-12 transition-transform duration-500">
                        <ShieldCheck size={40} className="text-white drop-shadow-lg" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-4xl font-display font-black text-foreground tracking-tight px-1">FairAssign</h1>
                        <div className="flex items-center justify-center gap-2">
                            <div className="h-px w-8 bg-primary/30" />
                            <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Strategic Invigilation Management</p>
                            <div className="h-px w-8 bg-primary/30" />
                        </div>
                    </div>
                </div>

                {/* Login Card */}
                <div className="glass-card rounded-[2rem] p-10 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

                    <form onSubmit={handleSubmit} className="space-y-7 relative z-10">
                        <div className="space-y-5">
                            {isSignUp && (
                                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-4 duration-500 delay-100">
                                    <Label htmlFor="fullName" className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">Full Name</Label>
                                    <div className="relative group/input">
                                        <User className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
                                        <Input
                                            id="fullName"
                                            type="text"
                                            placeholder="Professor John Doe"
                                            value={fullName}
                                            onChange={(e) => setFullName(e.target.value)}
                                            className="pl-12 bg-white/5 border-white/5 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all font-medium text-foreground placeholder:text-muted-foreground/30"
                                            disabled={isLoading}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2.5">
                                <Label htmlFor="email" className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">Admin Email</Label>
                                <div className="relative group/input">
                                    <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="admin@fairassign.edu"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="pl-12 bg-white/5 border-white/5 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all font-medium text-foreground placeholder:text-muted-foreground/30"
                                        disabled={isLoading}
                                        autoComplete="email"
                                    />
                                </div>
                            </div>

                            {!isForgotPassword && (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between px-1">
                                        <Label htmlFor="password" className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest">Master Password</Label>
                                        {!isSignUp && (
                                            <span
                                                onClick={() => setIsForgotPassword(true)}
                                                className="text-[10px] font-bold text-primary/70 hover:text-primary hover:underline cursor-pointer transition-colors uppercase tracking-wider"
                                            >
                                                Forgot?
                                            </span>
                                        )}
                                    </div>
                                    <div className="relative group/input">
                                        <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
                                        <Input
                                            id="password"
                                            type="password"
                                            placeholder="••••••••"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="pl-12 bg-white/5 border-white/5 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all font-medium text-foreground placeholder:text-muted-foreground/30"
                                            disabled={isLoading}
                                            autoComplete={isSignUp ? "new-password" : "current-password"}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                className="w-full h-14 text-sm font-black uppercase tracking-[0.15em] shadow-[0_10px_30px_rgba(var(--primary),0.2)] hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 rounded-xl"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-3">
                                        <div className="h-5 w-5 rounded-full border-[3px] border-white/30 border-r-white animate-spin" />
                                        <span>PROCESSING</span>
                                    </div>
                                ) : (
                                    <span>
                                        {isForgotPassword ? 'SEND RESET LINK' : (isSignUp ? 'REGISTER ACCOUNT' : 'SECURE SIGN IN')}
                                    </span>
                                )}
                            </Button>
                        </div>

                        <div className="text-center">
                            {isForgotPassword ? (
                                <button
                                    type="button"
                                    onClick={() => setIsForgotPassword(false)}
                                    className="group/btn inline-flex items-center gap-2 hover:translate-y-[-1px] transition-transform"
                                    disabled={isLoading}
                                >
                                    <span className="text-[11px] font-black text-primary uppercase tracking-widest group-hover/btn:underline flex items-center gap-1.5">
                                        Back to Login
                                    </span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setIsSignUp(!isSignUp)}
                                    className="group/btn inline-flex items-center gap-2 hover:translate-y-[-1px] transition-transform"
                                    disabled={isLoading}
                                >
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover/btn:text-foreground transition-colors">
                                        {isSignUp ? "Already secured?" : "Not onboarded?"}
                                    </span>
                                    <span className="text-[11px] font-black text-primary uppercase tracking-widest group-hover/btn:underline flex items-center gap-1.5">
                                        {isSignUp ? "SIGN IN" : <>ORGANIZE NOW <UserPlus size={12} className="mt-[-1px]" /></>}
                                    </span>
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                <div className="mt-12 text-center space-y-4">
                    <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.3em] font-display">
                        &copy; {new Date().getFullYear()} FAIRASSIGN INTELLIGENCE SYSTEMS
                    </p>
                    <div className="flex items-center justify-center gap-4 opacity-30">
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
                        <div className="h-1.5 w-1.5 rounded-full bg-foreground" />
                    </div>
                </div>
            </div>
        </div>
    );
}
