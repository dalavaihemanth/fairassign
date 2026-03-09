import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ShieldCheck, Lock } from 'lucide-react';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            toast.success('Password updated successfully! Please login with your new password.');
            navigate('/login');
        } catch (err: any) {
            toast.error(err.message || 'Failed to update password.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-app-gradient flex items-center justify-center p-4 relative overflow-hidden">
            {/* Premium Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 rounded-full blur-[120px] animate-pulse delay-700 pointer-events-none" />

            <div className="w-full max-w-md relative z-10 animate-in fade-in slide-in-from-bottom-12 duration-1000 ease-out fill-mode-both">
                <div className="text-center mb-10 space-y-3">
                    <div className="mx-auto w-20 h-20 rounded-[2.5rem] bg-sidebar-primary shadow-[0_20px_50px_rgba(var(--sidebar-primary),0.3)] flex items-center justify-center mb-6 border border-white/20 transform hover:rotate-12 transition-transform duration-500">
                        <ShieldCheck size={40} className="text-white drop-shadow-lg" />
                    </div>
                    <div className="space-y-1">
                        <h1 className="text-4xl font-display font-black text-foreground tracking-tight px-1">Update Security</h1>
                        <p className="text-[11px] font-black text-primary uppercase tracking-[0.2em]">Secure your account access</p>
                    </div>
                </div>

                <div className="glass-card rounded-[2rem] p-10 border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative overflow-hidden">
                    <form onSubmit={handleResetPassword} className="space-y-7 relative z-10">
                        <div className="space-y-5">
                            <div className="space-y-2.5">
                                <Label htmlFor="password" className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">New Password</Label>
                                <div className="relative group/input">
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="pl-12 bg-white/5 border-white/5 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                <Label htmlFor="confirmPassword" className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-widest ml-1">Confirm Password</Label>
                                <div className="relative group/input">
                                    <Lock className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors" />
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="pl-12 bg-white/5 border-white/5 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 h-12 rounded-xl transition-all"
                                        disabled={isLoading}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-14 text-sm font-black uppercase tracking-[0.15em] shadow-[0_10px_30px_rgba(var(--primary),0.2)] hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 rounded-xl"
                            disabled={isLoading}
                        >
                            {isLoading ? 'UPDATING...' : 'UPDATE PASSWORD'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    );
}
