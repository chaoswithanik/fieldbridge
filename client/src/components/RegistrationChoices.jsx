import { NavLink } from 'react-router-dom';
import { Sprout, ShoppingBasket } from 'lucide-react';

export default function RegistrationChoices() {
  return (
    <nav className="registration-choices" aria-label="নিবন্ধনের ধরন">
      <NavLink to="/register" end>
        <Sprout size={17} aria-hidden="true" /> কৃষক নিবন্ধন
      </NavLink>
      <NavLink to="/register/buyer">
        <ShoppingBasket size={17} aria-hidden="true" /> ক্রেতা নিবন্ধন
      </NavLink>
    </nav>
  );
}
