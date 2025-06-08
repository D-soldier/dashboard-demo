'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import postgres from 'postgres';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

const FormData = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(), // Coerce to number
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});

const CreateInvoice = FormData.omit({ id: true, date: true });

export async function createInvoice(fromData: FormData) {

    // 修正后重新解析数据
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: fromData.get('customerId'),
        amount: fromData.get('amount'), // Coerce to number
        status: fromData.get('status'),
    });

    const amountInCents = amount * 100; // Convert to cents
    const date = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
    // console.log(customer, amount, status);
}

export async function updateInvoice(id: string, fromData: FormData) {
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: fromData.get('customerId'),
        amount: fromData.get('amount'), // Coerce to number
        status: fromData.get('status'),
    });

    const amountInCents = amount * 100; // Convert to cents
    // const date = new Date().toISOString().split('T')[0]; // Get current date in YYYY-MM-DD format
    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    // 尝试删除发票
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw new Error('Failed to delete invoice.');
  }
}

export async function authenticate(prevState: string | undefined, formData: FormData) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }
        throw error;
    }
}
