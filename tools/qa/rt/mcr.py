import json, numpy as np
exec(open('mc.py').read().split("for ch,name")[0].replace("def run(","def _unused("))
P=json.load(open('prof.json')); rows=P['rows']; G=np.array(P['g']); h=np.array([r['h'] for r in rows],float)
def refl(ch, n=300000, alb=0.13, muc=0.9, seed=2):
    rng=np.random.default_rng(seed)
    ext=np.array([r['ext'][ch] for r in rows]); ray=np.array([r['ray'][ch] for r in rows]); aer=np.array([[a[ch] for a in r['aer']] for r in rows])
    dtau=0.5*(ext[1:]+ext[:-1]); tauv=np.concatenate([[0],np.cumsum(dtau[::-1])])[::-1]; T=tauv[0]
    tv=np.zeros(n); mu=np.full(n,-1.0); w=np.ones(n); alive=np.ones(n,bool); up=0.0
    hof=lambda t: np.interp(-t,-tauv,h)
    for it in range(600):
        idx=np.where(alive)[0]
        if len(idx)==0: break
        s=-np.log(rng.random(len(idx))); tnew=tv[idx]-s*mu[idx]
        esc=tnew<0; e_i=idx[esc]; up+=w[e_i][mu[e_i]>muc].sum(); alive[e_i]=False
        gnd=tnew>=T; gi=idx[gnd]
        if len(gi): w[gi]*=alb; tv[gi]=T-1e-9; mu[gi]=np.sqrt(rng.random(len(gi))); alive[gi]&=w[gi]>1e-4
        m_=~esc&~gnd; si=idx[m_]; tv[si]=tnew[m_]
        if len(si)==0: continue
        zi=np.clip(np.round(hof(tv[si])).astype(int),0,len(h)-1)
        sc_r=ray[zi]; sc_a=aer[zi]; e=ext[zi]; tot=sc_r+sc_a.sum(1); w[si]*=tot/np.maximum(e,1e-30)
        u=rng.random(len(si))*np.maximum(tot,1e-30); cum=np.cumsum(np.column_stack([sc_r,sc_a]),1); sp=(u[:,None]>cum).sum(1)
        g=np.where(sp==0,0.0,G[np.clip(sp-1,0,2),ch]); xi=rng.random(len(si)); gg=np.where(np.abs(g)<1e-3,1e-3,g)
        ct=np.where(np.abs(g)<1e-3,2*xi-1,(1+gg*gg-((1-gg*gg)/(1-gg+2*gg*xi))**2)/(2*gg))
        st=np.sqrt(np.maximum(0,1-ct*ct)); ph=2*np.pi*rng.random(len(si)); m=mu[si]
        mu[si]=np.clip(m*ct+np.sqrt(np.maximum(0,1-m*m))*st*np.cos(ph),-1,1); alive[si]&=w[si]>1e-4
    return up/n/(1-muc*muc)
print('MC nadir I/F', [round(refl(c),4) for c in range(3)])
