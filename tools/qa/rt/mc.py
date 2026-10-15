# plane-parallel Monte Carlo reference: downward flux at altitude z_obs per unit incident flux (μ0·F), Titan profile
import json, numpy as np, sys
P=json.load(open('prof.json')); rows=P['rows']; G=np.array(P['g'])  # G[aer][ch]
h=np.array([r['h'] for r in rows],float)
def run(ch, mu0, zobs=0.0, n=200000, alb=0.13, seed=1):
    rng=np.random.default_rng(seed)
    ext=np.array([r['ext'][ch] for r in rows]); ray=np.array([r['ray'][ch] for r in rows]); aer=np.array([[a[ch] for a in r['aer']] for r in rows])
    # vertical optical depth from top
    dtau=0.5*(ext[1:]+ext[:-1]); tauv=np.concatenate([[0],np.cumsum(dtau[::-1])])[::-1]  # tauv[i]= tau above h[i]
    T=tauv[0]; tau_obs=np.interp(zobs,h,tauv)
    tv=np.zeros(n); mu=np.full(n,-mu0); w=np.ones(n); alive=np.ones(n,bool); down=0.0
    def hof(t): return np.interp(-t,-tauv,h)
    for it in range(400):
        idx=np.where(alive)[0]
        if len(idx)==0: break
        s=-np.log(rng.random(len(idx)))
        tnew=tv[idx]-s*mu[idx]  # mu<0 down → tau increases
        # crossing observer level downward → tally
        cross=(mu[idx]<0)&(tv[idx]<tau_obs)&(tnew>=tau_obs)
        down+=w[idx][cross].sum()
        # crossing observer upward isn't tallied (net down wanted: we tally downward flux only)
        esc=tnew<0
        alive[idx[esc]]=False
        gnd=tnew>=T
        gi=idx[gnd]
        # Lambert ground bounce
        if len(gi):
            w[gi]*=alb; tv[gi]=T-1e-9; mu[gi]=np.sqrt(rng.random(len(gi)))
            alive[gi]&= w[gi]>1e-4
        si=idx[~esc&~gnd]; tv[si]=tnew[~esc&~gnd]
        if len(si)==0: continue
        z=hof(tv[si]); zi=np.clip(np.round(z).astype(int),0,len(h)-1)
        sc_r=ray[zi]; sc_a=aer[zi]; e=ext[zi]
        tot=sc_r+sc_a.sum(1); w[si]*=tot/np.maximum(e,1e-30)
        u=rng.random(len(si))*np.maximum(tot,1e-30); cum=np.cumsum(np.column_stack([sc_r,sc_a]),1)
        sp=(u[:,None]>cum).sum(1)
        g=np.where(sp==0,0.0,G[np.clip(sp-1,0,2),ch])
        # HG sampling of cos theta
        xi=rng.random(len(si)); gg=np.where(np.abs(g)<1e-3,1e-3,g)
        ct=np.where(np.abs(g)<1e-3,2*xi-1,(1+gg*gg-((1-gg*gg)/(1-gg+2*gg*xi))**2)/(2*gg))
        # rayleigh: sample approximately isotropic (fine for flux)
        st=np.sqrt(np.maximum(0,1-ct*ct)); ph=2*np.pi*rng.random(len(si)); m=mu[si]
        mu[si]=np.clip(m*ct+np.sqrt(np.maximum(0,1-m*m))*st*np.cos(ph),-1,1)
        alive[si]&= w[si]>1e-4
    return down/n, T
for ch,name in enumerate('RGB'):
    for mu0 in (1.0,0.5):
        f,T=run(ch,mu0); print(name,'mu0',mu0,'tau',round(T,2),'down flux fraction at surface',f'{f:.4f}')
