import Link from "next/link";
import { BagButton } from "./CartProvider";
export function ShopHeader() { return <header className="site-header compact-header"><Link className="wordmark" href="/" aria-label="Vineyard Sun home">VINEYARD <span>SUN</span></Link><nav aria-label="Main navigation"><Link href="/#catalog">Shop</Link><Link href="/custom-vineyard-sunglasses">For wineries</Link></nav><BagButton /></header>; }
