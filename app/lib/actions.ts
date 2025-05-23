'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import postgres from 'postgres';
import { redirect } from 'next/navigation';

const FormSchema = z.object({
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId')?.toString() ?? '',
    amount: formData.get('amount'),
    status: formData.get('status')?.toString() ?? '',
  });
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId')?.toString() ?? '',
    amount: formData.get('amount'),
    status: formData.get('status')?.toString() ?? '',
  });

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}, date = ${date}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error(error);
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

// ===== Added authenticate function =====
export async function authenticate(formData: FormData) {
  const emailRaw = formData.get('email');
  const passwordRaw = formData.get('password');

  if (!emailRaw || !passwordRaw) {
    throw new Error('Email and password are required.');
  }

  const email = emailRaw.toString();
  const password = passwordRaw.toString();

  // Query user by email (adjust your table/fields accordingly)
  const users = await sql`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `;

  if (!users || users.length === 0) {
    throw new Error('Invalid email or password.');
  }

  const user = users[0];

  // TODO: Replace with real password hash verification, e.g. bcrypt.compare
  const isPasswordValid = password === 'your-demo-password'; // Demo placeholder

  if (!isPasswordValid) {
    throw new Error('Invalid email or password.');
  }

  // On successful auth, redirect to dashboard or wherever
  redirect('/dashboard');
}
